var TOTAL_STAGES = 7;
var stages = [];
for (var i = 1; i <= TOTAL_STAGES; i++) {
    stages.push(document.getElementById('stage-' + i));
}

function getFocusTarget(stage) {
    return stage.querySelector('[data-focus-target]') || stage;
}

function showStage(n, opts) {
    if (n < 1 || n > TOTAL_STAGES) return;
    opts = opts || {};

    for (var i = 0; i < stages.length; i++) {
        var stage = stages[i];
        if (!stage) continue;
        stage.hidden = (i + 1 !== n);
    }

    var current = stages[n - 1];
    if (current && opts.focus !== false) {
        getFocusTarget(current).focus();
    }

    if (current && n === 2) {
        runVerification();
    }

    if (current && n === 4) {
        startObstacle();
    }
}

function getStartStage() {
    var params = new URLSearchParams(window.location.search);

    if (params.get('skip') === '1') {
        return 3;
    }

    var stageParam = parseInt(params.get('stage'), 10);
    if (stageParam >= 1 && stageParam <= TOTAL_STAGES) {
        return stageParam;
    }

    return 1;
}

/* === Stufe 1: Altersabfrage === */
var gateYes = document.getElementById('gate-yes');
var gateNo = document.getElementById('gate-no');
var gateMessage = document.getElementById('gate-message');

if (gateYes) {
    gateYes.addEventListener('click', function () {
        showStage(2);
    });
}

if (gateNo) {
    gateNo.addEventListener('click', function () {
        gateMessage.textContent = 'Korrekte Antwort.';
        setTimeout(function () {
            gateMessage.textContent = '';
            showStage(2);
        }, 1800);
    });
}

/* === Stufe 2: Verifizierung === */
var VERIFY_STEPS = [
    'Prüfe Altersnachweis',
    'Verbinde mit Server',
    'Entsperre exklusive Inhalte',
    'Kalibriere Bildqualität',
    'Analysiere Frequenz',
    'Fast geschafft'
];
var STEP_MS = 1200;
var STEPS_TOTAL_MS = VERIFY_STEPS.length * STEP_MS;
var PAUSE_AT_97_MS = 700;
var FINISH_MS = 400;
var REDUCED_TOTAL_MS = 1500;

var verifyStatus = document.getElementById('verify-status');
var verifyTrack = document.getElementById('verify-track');
var verifyBar = document.getElementById('verify-bar');
var verifyPercent = document.getElementById('verify-percent');

var verifyRunning = false;
var verifyTimeouts = [];
var verifyFrame = null;

function clearVerifyTimers() {
    for (var i = 0; i < verifyTimeouts.length; i++) {
        clearTimeout(verifyTimeouts[i]);
    }
    verifyTimeouts = [];
    if (verifyFrame !== null) {
        cancelAnimationFrame(verifyFrame);
        verifyFrame = null;
    }
}

function setPercent(p) {
    var rounded = Math.round(p);
    verifyBar.style.width = rounded + '%';
    verifyPercent.textContent = rounded + '%';
    verifyTrack.setAttribute('aria-valuenow', String(rounded));
}

function runVerification() {
    if (verifyRunning) return;
    verifyRunning = true;
    clearVerifyTimers();

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    setPercent(0);
    verifyStatus.textContent = VERIFY_STEPS[0];

    if (reduced) {
        var reducedStepMs = REDUCED_TOTAL_MS / VERIFY_STEPS.length;
        for (var i = 1; i < VERIFY_STEPS.length; i++) {
            (function (index) {
                verifyTimeouts.push(setTimeout(function () {
                    verifyStatus.textContent = VERIFY_STEPS[index];
                }, index * reducedStepMs));
            })(i);
        }

        var reducedStart = performance.now();
        (function reducedFrame(now) {
            var elapsed = now - reducedStart;
            var percent = Math.min(100, (elapsed / REDUCED_TOTAL_MS) * 100);
            setPercent(percent);
            if (elapsed < REDUCED_TOTAL_MS) {
                verifyFrame = requestAnimationFrame(reducedFrame);
            } else {
                verifyFrame = null;
                verifyRunning = false;
                showStage(3);
            }
        })(reducedStart);

        return;
    }

    for (var s = 1; s < VERIFY_STEPS.length; s++) {
        (function (index) {
            verifyTimeouts.push(setTimeout(function () {
                verifyStatus.textContent = VERIFY_STEPS[index];
            }, index * STEP_MS));
        })(s);
    }

    var start = performance.now();
    (function frame(now) {
        var elapsed = now - start;
        var percent;

        if (elapsed < STEPS_TOTAL_MS) {
            percent = Math.min(97, (elapsed / STEPS_TOTAL_MS) * 97);
        } else if (elapsed < STEPS_TOTAL_MS + PAUSE_AT_97_MS) {
            percent = 97;
        } else {
            var finishElapsed = elapsed - STEPS_TOTAL_MS - PAUSE_AT_97_MS;
            percent = 97 + Math.min(1, finishElapsed / FINISH_MS) * 3;
        }

        setPercent(percent);

        if (percent < 100) {
            verifyFrame = requestAnimationFrame(frame);
        } else {
            verifyFrame = null;
            verifyRunning = false;
            showStage(3);
        }
    })(start);
}

/* === Stufe 3: Reveal === */
var revealNext = document.getElementById('reveal-next');
if (revealNext) {
    revealNext.addEventListener('click', function () {
        showStage(4);
    });
}

/* === Stufe 4: Hürdenlauf === */
var obstacleField = document.getElementById('obstacle-field');
var obstacleTimer = document.getElementById('obstacle-timer');
var obstacleMessage = document.getElementById('obstacle-message');
var obstacleReal = document.getElementById('obstacle-real');
var obstacleDecoy1 = document.getElementById('obstacle-decoy-1');
var obstacleDecoy2 = document.getElementById('obstacle-decoy-2');
var obstacleTrap = document.getElementById('obstacle-trap');
var obstacleButtons = [obstacleDecoy1, obstacleDecoy2, obstacleTrap, obstacleReal].filter(Boolean);

var OBSTACLE_WAIT_S = 5;
var OBSTACLE_MAX_DODGES = 4;
var RICKROLL_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

var obstacleWaitRemaining = OBSTACLE_WAIT_S;
var obstacleCountdownTimer = null;
var obstacleSettled = false;
var obstacleDodgeCount = 0;
var obstacleMessageTimer = null;

function placeObstacleButtonRandomly(el) {
    if (!obstacleField) return;
    var fieldRect = obstacleField.getBoundingClientRect();
    var elRect = el.getBoundingClientRect();
    var maxX = Math.max(0, fieldRect.width - elRect.width - 8);
    var maxY = Math.max(0, fieldRect.height - elRect.height - 8);
    el.style.left = (4 + Math.random() * maxX) + 'px';
    el.style.top = (4 + Math.random() * maxY) + 'px';
}

function shuffleObstacleButtons() {
    obstacleButtons.forEach(placeObstacleButtonRandomly);
}

function showObstacleMessage(text) {
    if (!obstacleMessage) return;
    obstacleMessage.textContent = text;
    clearTimeout(obstacleMessageTimer);
    obstacleMessageTimer = setTimeout(function () {
        obstacleMessage.textContent = '';
    }, 1800);
}

function obstacleTick() {
    if (obstacleWaitRemaining <= 0) {
        obstacleTimer.textContent = '';
        obstacleReal.disabled = false;
        obstacleReal.classList.add('is-ready');
        return;
    }
    obstacleTimer.textContent = 'Werbung läuft noch ' + obstacleWaitRemaining + 's.';
    obstacleWaitRemaining--;
    obstacleCountdownTimer = setTimeout(obstacleTick, 1000);
}

function startObstacleCountdown(seconds) {
    clearTimeout(obstacleCountdownTimer);
    obstacleWaitRemaining = seconds;
    obstacleReal.disabled = true;
    obstacleReal.classList.remove('is-ready');
    obstacleTick();
}

function penalizeObstacle(seconds) {
    if (obstacleReal.disabled) {
        obstacleWaitRemaining += seconds;
    } else {
        startObstacleCountdown(seconds);
    }
}

function settleObstacleReal() {
    if (obstacleSettled) return;
    obstacleSettled = true;
    obstacleReal.classList.add('is-settled');
    obstacleReal.textContent = 'na gut, hier.';
}

function dodgeObstacleReal() {
    obstacleDodgeCount++;
    if (obstacleDodgeCount >= OBSTACLE_MAX_DODGES) {
        settleObstacleReal();
        return;
    }
    placeObstacleButtonRandomly(obstacleReal);
}

function startObstacle() {
    if (!obstacleField) return;
    obstacleSettled = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    obstacleDodgeCount = 0;
    obstacleMessage.textContent = '';
    obstacleReal.textContent = 'weiter';
    obstacleReal.classList.remove('is-settled', 'is-ready');
    shuffleObstacleButtons();
    startObstacleCountdown(OBSTACLE_WAIT_S);
}

if (obstacleField && obstacleReal) {
    obstacleReal.addEventListener('focus', settleObstacleReal);

    // pointerdown statt click: reagiert auf Maus UND Touch, und die Flucht
    // passiert, bevor der Klick/Tap überhaupt zustande kommt.
    obstacleReal.addEventListener('pointerdown', function (e) {
        if (obstacleReal.disabled || obstacleSettled) return;
        e.preventDefault();
        dodgeObstacleReal();
    });

    obstacleReal.addEventListener('click', function () {
        if (obstacleReal.disabled || !obstacleSettled) return;
        clearTimeout(obstacleCountdownTimer);
        showStage(5);
    });

    [obstacleDecoy1, obstacleDecoy2].forEach(function (btn) {
        if (!btn) return;
        btn.addEventListener('click', function () {
            showObstacleMessage('Falscher Knopf. Nochmal.');
            penalizeObstacle(1);
            shuffleObstacleButtons();
        });
    });

    if (obstacleTrap) {
        obstacleTrap.addEventListener('click', function () {
            showObstacleMessage('Na gut, du wolltest es so.');
            penalizeObstacle(3);
            shuffleObstacleButtons();
            window.open(RICKROLL_URL, '_blank', 'noopener');
        });
    }
}

/* === Stufe 5: Galerie === */
function fieldOrPlaceholder(value, format) {
    if (value === 'PLATZHALTER') {
        return '<span class="placeholder-dash" aria-hidden="true"></span>';
    }
    return format ? format(value) : value;
}

function renderRating(rating) {
    var dots = '';
    for (var i = 1; i <= 5; i++) {
        dots += '<span class="rating-dot' + (i <= rating ? ' filled' : '') + '" aria-hidden="true"></span>';
    }
    return '<span class="rating" role="img" aria-label="' + rating + ' von 5 Lalafell">' + dots + '</span>';
}

function renderFanCard(fan, index) {
    var article = document.createElement('article');
    article.className = 'fan-card glass-panel';

    var photo = document.createElement('div');
    photo.className = 'fan-photo';

    var placeholder = document.createElement('span');
    placeholder.className = 'fan-photo-placeholder';
    placeholder.setAttribute('aria-hidden', 'true');
    placeholder.textContent = 'Foto folgt';
    photo.appendChild(placeholder);

    var img = document.createElement('img');
    img.src = fan.image;
    img.alt = fan.alt === 'PLATZHALTER' ? '' : fan.alt;
    if (index > 0) {
        img.loading = 'lazy';
    }
    img.addEventListener('error', function () {
        img.style.display = 'none';
    });
    photo.appendChild(img);
    article.appendChild(photo);

    var body = document.createElement('div');
    body.className = 'fan-card-body';

    var name = document.createElement('h3');
    name.className = 'fan-name';
    name.innerHTML = fieldOrPlaceholder(fan.name);
    body.appendChild(name);

    var specs = document.createElement('dl');
    specs.className = 'fan-specs';

    var rows = [
        ['Umdrehungen', fieldOrPlaceholder(fan.rpm, function (v) { return v + ' U/min'; })],
        ['Lautstärke', fieldOrPlaceholder(fan.noise, function (v) { return v + ' dB'; })],
        ['Statischer Druck', fieldOrPlaceholder(fan.pressure, function (v) { return v + ' mm H2O'; })],
        ['Einbauort', fieldOrPlaceholder(fan.location)],
        ['Bewertung', renderRating(fan.rating)]
    ];

    rows.forEach(function (row) {
        var rowEl = document.createElement('div');
        rowEl.className = 'fan-spec-row';
        var dt = document.createElement('dt');
        dt.textContent = row[0];
        var dd = document.createElement('dd');
        dd.innerHTML = row[1];
        rowEl.appendChild(dt);
        rowEl.appendChild(dd);
        specs.appendChild(rowEl);
    });

    body.appendChild(specs);

    var comment = document.createElement('p');
    comment.className = 'fan-comment';
    comment.innerHTML = fieldOrPlaceholder(fan.comment);
    body.appendChild(comment);

    article.appendChild(body);
    return article;
}

var galleryGrid = document.getElementById('gallery-grid');
if (galleryGrid) {
    fans.forEach(function (fan, index) {
        galleryGrid.appendChild(renderFanCard(fan, index));
    });
}

var galleryNext = document.getElementById('gallery-next');
if (galleryNext) {
    galleryNext.addEventListener('click', function () {
        showStage(6);
    });
}

/* === Stufe 6: Abo-Stufen === */
var TIER_LABELS = {
    basis: 'Basis-Luftstrom',
    silent: 'Silent Flow',
    full: 'Full Blast'
};
var tierButtons = document.querySelectorAll('.tier-cta');
var tierStatus = document.getElementById('tier-status');
var tierProcessing = false;

function processTier(tier) {
    if (tierProcessing) return;

    if (tier === 'basis') {
        tierStatus.textContent = 'Kostenlos? Netter Versuch.';
        setTimeout(function () {
            tierStatus.textContent = '';
        }, 1800);
        return;
    }

    tierProcessing = true;

    tierButtons.forEach(function (btn) {
        btn.disabled = true;
    });

    var label = TIER_LABELS[tier] || 'Abo';
    tierStatus.textContent = 'Verarbeite ' + label + '.';

    setTimeout(function () {
        tierStatus.textContent = 'Prüfe Zahlungsdaten. Es wird nichts abgebucht.';
    }, 900);

    setTimeout(function () {
        tierProcessing = false;
        tierButtons.forEach(function (btn) {
            btn.disabled = false;
        });
        tierStatus.textContent = '';
        showStage(7);
    }, 2000);
}

tierButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
        processTier(btn.getAttribute('data-tier'));
    });
});

/* === Stufe 7: Abgang === */
var outroRestart = document.getElementById('outro-restart');
if (outroRestart) {
    outroRestart.addEventListener('click', function () {
        showStage(1);
    });
}

window.onlyFans = {
    goToStage: showStage
};

showStage(getStartStage(), { focus: false });
