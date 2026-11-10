var RICKROLL_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
var TOTAL_STAGES = 7;
var stages = [];
for (var i = 1; i <= TOTAL_STAGES; i++) {
    stages.push(document.getElementById('stage-' + i));
}

var reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
function prefersReducedMotion() {
    return reducedQuery.matches;
}

/* Global gag switch. "Ich gebe auf" turns it off for good. */
var gagsOn = true;
var currentStage = 1;

/* === Toast (aria-live, never a browser dialog) === */
var toastEl = document.getElementById('toast');
var toastTimer = null;

function showToast(text) {
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
        toastEl.classList.remove('is-visible');
    }, 3200);
}

function getFocusTarget(stage) {
    return stage.querySelector('[data-focus-target]') || stage;
}

function showStage(n, opts) {
    if (n < 1 || n > TOTAL_STAGES) return;
    opts = opts || {};
    currentStage = n;

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

/* === Stufe 1: Temperaturabfrage === */
var gateYes = document.getElementById('gate-yes');
var gateNo = document.getElementById('gate-no');
var gateMessage = document.getElementById('gate-message');
var gateTimer = null;

function answerGate(text) {
    if (gateTimer) return;
    gateMessage.textContent = text;
    gateTimer = setTimeout(function () {
        gateTimer = null;
        gateMessage.textContent = '';
        showStage(2);
    }, 1600);
}

if (gateYes) {
    gateYes.addEventListener('click', function () {
        answerGate('Dann bist du hier richtig und gleich weht ein frischer Wind.');
    });
}

if (gateNo) {
    gateNo.addEventListener('click', function () {
        answerGate('Verständlich, als Lalafell sitzt du nun mal näher am kalten Boden.');
    });
}

/* === Stufe 2: Verifizierung === */
var VERIFY_STEPS = [
    'Messe Raumtemperatur',
    'Verbinde mit Gehäuse',
    'Entsperre exklusive Luft',
    'Kalibriere Drehzahl',
    'Zähle Staubflocken',
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

    var reduced = prefersReducedMotion();

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

var obstacleWaitRemaining = OBSTACLE_WAIT_S;
var obstacleCountdownTimer = null;
var obstacleSettled = false;
var obstacleDodgeCount = 0;
var obstacleMessageTimer = null;

function placeObstacleButtonRandomly(el, avoid) {
    if (!obstacleField || obstacleField.classList.contains('is-static')) return;
    var fieldRect = obstacleField.getBoundingClientRect();
    var elRect = el.getBoundingClientRect();
    var maxX = Math.max(0, fieldRect.width - elRect.width - 8);
    var maxY = Math.max(0, fieldRect.height - elRect.height - 8);
    var x = 0;
    var y = 0;
    // Try a few times to avoid sitting on top of another button.
    for (var attempt = 0; attempt < 25; attempt++) {
        x = 4 + Math.random() * maxX;
        y = 4 + Math.random() * maxY;
        var clash = (avoid || []).some(function (other) {
            if (other === el) return false;
            var ox = parseFloat(other.style.left) || 0;
            var oy = parseFloat(other.style.top) || 0;
            var o = other.getBoundingClientRect();
            return x < ox + o.width + 6 && x + elRect.width + 6 > ox &&
                   y < oy + o.height + 6 && y + elRect.height + 6 > oy;
        });
        if (!clash) break;
    }
    el.style.left = x + 'px';
    el.style.top = y + 'px';
}

function shuffleObstacleButtons() {
    var placed = [];
    obstacleButtons.forEach(function (btn) {
        placeObstacleButtonRandomly(btn, placed);
        placed.push(btn);
    });
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
    placeObstacleButtonRandomly(obstacleReal, obstacleButtons);
}

function startObstacle() {
    if (!obstacleField) return;
    var reduced = prefersReducedMotion();
    // Reduced motion: nothing flies around, the buttons just sit in a column.
    obstacleField.classList.toggle('is-static', reduced);
    obstacleSettled = reduced;
    obstacleDodgeCount = 0;
    obstacleMessage.textContent = '';
    obstacleReal.textContent = reduced ? 'na gut, hier.' : 'weiter';
    obstacleReal.classList.remove('is-settled', 'is-ready');
    if (reduced) {
        obstacleReal.classList.add('is-settled');
    }
    shuffleObstacleButtons();
    startObstacleCountdown(OBSTACLE_WAIT_S);
}

if (obstacleField && obstacleReal) {
    // Keyboard users never get dodged: focus ends the game.
    obstacleReal.addEventListener('focus', settleObstacleReal);

    // pointerdown instead of click: reacts to mouse and touch, and the
    // escape happens before a click can even form.
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
            showObstacleMessage('Das war der falsche Knopf, versuch es nochmal.');
            penalizeObstacle(1);
            shuffleObstacleButtons();
        });
    });

    if (obstacleTrap) {
        obstacleTrap.addEventListener('click', function () {
            showObstacleMessage('Es stand extra drauf, aber du hast trotzdem gedrückt, was ich durchaus respektiere.');
            penalizeObstacle(3);
            shuffleObstacleButtons();
            // Restored on request: the trap button opens the classic in a new tab.
            window.open(RICKROLL_URL, '_blank', 'noopener');
        });
    }
}

/* === Stufe 5: Galerie === */
function renderRating(rating) {
    var dots = '';
    for (var i = 1; i <= 5; i++) {
        dots += '<span class="rating-dot' + (i <= rating ? ' filled' : '') + '" aria-hidden="true"></span>';
    }
    return '<span class="rating" role="img" aria-label="' + rating + ' von 5 Lalafell">' + dots + '</span>';
}

function formatSubs(fan, extra) {
    var n = fan.subs + (extra || 0);
    var label = n === 1 ? ' Abonnent' : ' Abonnenten';
    var text = n.toLocaleString('de-DE') + label + ', ' + fan.subsNote;
    if (extra) {
        text += ', plus du';
    }
    return text;
}

function makeEl(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
}

var DECOY_TYPES = ['text', 'spin', 'blow'];
var DECOY_LABELS = {
    text: 'JETZT ABONNIEREN!',
    spin: 'VIP-Zugang',
    blow: 'MEGA-Abo'
};
var TEXT_DECOY_STEPS = [
    'Falscher Knopf.',
    'Auch dieser nicht.',
    'Immer noch daneben.',
    'Der echte ist der kleine daneben.'
];

function attachDecoy(type, btn, article) {
    var step = 0;

    btn.addEventListener('click', function () {
        if (!gagsOn) return;

        if (type === 'text') {
            btn.textContent = TEXT_DECOY_STEPS[Math.min(step, TEXT_DECOY_STEPS.length - 1)];
            step++;
            showToast('Das war eine Attrappe, wobei der große Knopf es dir auch leicht gemacht hat.');
        } else if (type === 'spin') {
            showToast('Der Knopf dreht sich jetzt im Kreis und hält sich offenbar für einen Lüfter.');
            if (prefersReducedMotion()) {
                btn.textContent = 'VIP-Zugang (dreht sich in Gedanken)';
            } else {
                btn.classList.add('is-spinning');
                setTimeout(function () {
                    btn.classList.remove('is-spinning');
                }, 1300);
            }
        } else {
            showToast('Der Knopf hat die ganze Karte ein Stück weggepustet und sieht dabei sehr zufrieden aus.');
            if (prefersReducedMotion()) {
                btn.textContent = 'MEGA-Abo (Windstille)';
            } else {
                article.classList.add('is-blown');
                setTimeout(function () {
                    article.classList.remove('is-blown');
                }, 900);
            }
        }
    });
}

function renderFanCard(fan, index) {
    var article = makeEl('article', 'fan-card glass-panel');

    var photo = makeEl('div', 'fan-photo');
    var img = document.createElement('img');
    img.className = 'fan-rotor' + (fan.spin ? '' : ' no-spin');
    if (fan.spin) {
        img.style.setProperty('--spin', fan.spin + 's');
    }
    img.src = fan.image;
    img.alt = fan.alt;
    if (index > 0) {
        img.loading = 'lazy';
    }
    photo.appendChild(img);
    article.appendChild(photo);

    var body = makeEl('div', 'fan-card-body');

    body.appendChild(makeEl('h3', 'fan-name', fan.name));
    body.appendChild(makeEl('p', 'fan-maker', fan.maker + ', ' + fan.model));

    var status = makeEl('p', 'fan-status');
    status.appendChild(makeEl('span', 'status-dot'));
    status.appendChild(document.createTextNode(fan.status));
    body.appendChild(status);

    body.appendChild(makeEl('p', 'fan-bio', fan.bio));

    var table = makeEl('table', 'fan-specs');
    var caption = makeEl('caption', 'visually-hidden', 'Technische Daten von ' + fan.name);
    table.appendChild(caption);
    var tbody = document.createElement('tbody');

    var rows = [
        ['Durchmesser', fan.diameter],
        ['Drehzahl', fan.rpm + ' U/min'],
        ['Lautstärke', fan.noise + ' dB(A)'],
        ['Luftdurchsatz', fan.airflow + ' m³/h'],
        ['Statischer Druck', fan.pressure + ' mm H2O'],
        ['Lager', fan.bearing],
        ['Anschluss', fan.connector],
        ['RGB', fan.rgb],
        ['Einbauort', fan.location],
        ['Bewertung', null]
    ];

    rows.forEach(function (row) {
        var tr = document.createElement('tr');
        tr.appendChild(makeEl('th', null, row[0])).setAttribute('scope', 'row');
        var td = document.createElement('td');
        if (row[1] === null) {
            td.innerHTML = renderRating(fan.rating);
        } else {
            td.textContent = row[1];
        }
        tr.appendChild(td);
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    body.appendChild(table);

    var hobby = makeEl('p', 'fan-line');
    hobby.appendChild(makeEl('strong', null, 'Hobbys: '));
    hobby.appendChild(document.createTextNode(fan.hobby));
    body.appendChild(hobby);

    var seeking = makeEl('p', 'fan-line');
    seeking.appendChild(makeEl('strong', null, 'Was ich suche: '));
    seeking.appendChild(document.createTextNode(fan.seeking));
    body.appendChild(seeking);

    var subs = makeEl('p', 'fan-subs', formatSubs(fan, 0));
    body.appendChild(subs);

    var actions = makeEl('div', 'fan-actions');

    var type = DECOY_TYPES[index % DECOY_TYPES.length];
    var decoy = makeEl('button', 'fan-decoy gag-only', DECOY_LABELS[type]);
    decoy.type = 'button';
    attachDecoy(type, decoy, article);
    actions.appendChild(decoy);

    var real = makeEl('button', 'fan-sub-real', 'abonnieren');
    real.type = 'button';
    real.setAttribute('aria-pressed', 'false');
    real.setAttribute('aria-label', 'Profil ' + fan.name + ' abonnieren, kostenlos');
    real.addEventListener('click', function () {
        var on = real.getAttribute('aria-pressed') !== 'true';
        real.setAttribute('aria-pressed', on ? 'true' : 'false');
        real.textContent = on ? 'abonniert' : 'abonnieren';
        subs.textContent = formatSubs(fan, on ? 1 : 0);
        showToast(on
            ? 'Abonniert, der Lüfter weiß jetzt von dir und dreht trotzdem kein bisschen schneller.'
            : 'Abgemeldet, aber der Lüfter dreht unbeeindruckt weiter.');
    });
    actions.appendChild(real);

    body.appendChild(actions);
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

/* --- Boost: all rotors spin faster for a moment --- */
var boostTimer = null;
function boostFans(ms) {
    if (!galleryGrid || prefersReducedMotion() || !gagsOn) return;
    galleryGrid.classList.add('is-boosted');
    clearTimeout(boostTimer);
    boostTimer = setTimeout(function () {
        galleryGrid.classList.remove('is-boosted');
    }, ms);
}

/* --- Air meter: counts up for no reason --- */
var airValue = document.getElementById('air-value');
var airAmount = 4711.3;
var airInterval = null;

function renderAir() {
    if (!airValue) return;
    airValue.textContent = airAmount.toLocaleString('de-DE', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    });
}

function startAirMeter() {
    if (airInterval !== null || !airValue) return;
    airInterval = setInterval(function () {
        if (!gagsOn || currentStage !== 5) return;
        airAmount += 0.3 + Math.random() * 1.7;
        renderAir();
    }, 700);
}

function stopAirMeter() {
    if (airInterval !== null) {
        clearInterval(airInterval);
        airInterval = null;
    }
}

/* --- Unlock button: bar hangs at 99 percent --- */
var unlockBtn = document.getElementById('unlock-btn');
var unlockWrap = document.getElementById('unlock-wrap');
var unlockLabel = document.getElementById('unlock-label');
var unlockTrack = document.getElementById('unlock-track');
var unlockBar = document.getElementById('unlock-bar');
var unlockRunning = false;
var unlockTimers = [];

function setUnlockPercent(p) {
    unlockBar.style.width = p + '%';
    unlockTrack.setAttribute('aria-valuenow', String(p));
}

function clearUnlockTimers() {
    unlockTimers.forEach(function (t) {
        clearTimeout(t);
        clearInterval(t);
    });
    unlockTimers = [];
    unlockRunning = false;
}

function runUnlock() {
    if (unlockRunning || !gagsOn) return;
    unlockRunning = true;
    unlockBtn.disabled = true;
    unlockWrap.hidden = false;
    unlockLabel.textContent = 'Lade exklusiven Inhalt';
    setUnlockPercent(0);

    function finish() {
        unlockLabel.textContent = '99 Prozent, gleich ist es so weit.';
        unlockTimers.push(setTimeout(function () {
            unlockWrap.hidden = true;
            unlockBtn.disabled = false;
            unlockBtn.textContent = 'Nochmal freischalten';
            unlockRunning = false;
            showToast('Das war der exklusive Inhalt, ein paar Lüfter drehen jetzt kurz schneller.');
            boostFans(3500);
        }, 1800));
    }

    if (prefersReducedMotion()) {
        setUnlockPercent(99);
        finish();
        return;
    }

    var p = 0;
    var iv = setInterval(function () {
        p += 3;
        if (p >= 99) {
            p = 99;
            clearInterval(iv);
            setUnlockPercent(p);
            finish();
            return;
        }
        setUnlockPercent(p);
    }, 70);
    unlockTimers.push(iv);
}

if (unlockBtn) {
    unlockBtn.addEventListener('click', runUnlock);
}

/* --- Tip button --- */
var tipBtn = document.getElementById('tip-btn');
if (tipBtn) {
    tipBtn.addEventListener('click', function () {
        if (!gagsOn) return;
        showToast('Danke, die Lüfter drehen jetzt aus reiner Dankbarkeit schneller.');
        boostFans(2500);
    });
}

/* === Stufe 6: Abo-Stufen === */
var TIER_LABELS = {
    bronze: 'Bronze',
    silber: 'Silber',
    gold: 'Gold'
};
var tierButtons = document.querySelectorAll('.tier-cta');
var tierStatus = document.getElementById('tier-status');
var tierProcessing = false;
var tierTimers = [];

function clearTierTimers() {
    tierTimers.forEach(clearTimeout);
    tierTimers = [];
    tierProcessing = false;
    tierButtons.forEach(function (btn) {
        btn.disabled = false;
    });
    if (tierStatus) tierStatus.textContent = '';
}

function processTier(tier) {
    if (tierProcessing) return;

    if (!gagsOn) {
        showStage(7);
        return;
    }

    tierProcessing = true;
    tierButtons.forEach(function (btn) {
        btn.disabled = true;
    });

    var label = TIER_LABELS[tier] || 'Abo';
    tierStatus.textContent = 'Verarbeite deine Bestellung für ' + label + '.';

    tierTimers.push(setTimeout(function () {
        tierStatus.textContent = 'Kosten geprüft, es bleibt bei 0,00 Euro.';
    }, 900));

    tierTimers.push(setTimeout(function () {
        clearTierTimers();
        showStage(7);
    }, 2000));
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
        showStage(gagsOn ? 1 : 5);
    });
}

/* === Ich gebe auf === */
var giveUpBtn = document.getElementById('give-up');

function giveUp() {
    if (!gagsOn) return;
    gagsOn = false;
    document.body.classList.add('no-gags');

    clearVerifyTimers();
    verifyRunning = false;
    clearTimeout(obstacleCountdownTimer);
    clearTimeout(obstacleMessageTimer);
    clearTimeout(boostTimer);
    clearUnlockTimers();
    clearTierTimers();
    if (gateTimer) {
        clearTimeout(gateTimer);
        gateTimer = null;
        gateMessage.textContent = '';
    }
    stopAirMeter();
    if (galleryGrid) galleryGrid.classList.remove('is-boosted');
    if (unlockWrap) unlockWrap.hidden = true;

    if (giveUpBtn) {
        giveUpBtn.textContent = 'Gags sind aus';
        giveUpBtn.disabled = true;
    }

    if (currentStage !== 6 && currentStage !== 7) {
        showStage(5);
    } else {
        stages[currentStage - 1].querySelector('[data-focus-target]').focus();
    }
    showToast('Okay, die Gags sind aus und hier sind die Lüfter, ganz ohne Schnickschnack.');
}

if (giveUpBtn) {
    giveUpBtn.addEventListener('click', giveUp);
}

window.onlyFans = {
    goToStage: showStage
};

startAirMeter();
showStage(getStartStage(), { focus: false });
