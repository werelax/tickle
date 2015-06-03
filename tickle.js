var configConstants = {
  dragThreshold: 10,
  swipeThreshold: 30,
  swipeTimeout: 10000,
  swipeSpeedThreshold: 0.2,
  clickEnabled: true,
  dragEnabled: true,
  swipeEnabled: true,
  pinchEnabled: false,
  timeout: 500
};

// Some Utils

function assign() {
  var args = Array.prototype.slice.call(arguments);
  return args.reduce(function(acc, el) {
    for (var k in el) if (el.hasOwnProperty(k)) acc[k] = el[k];
    return acc;
  }, {});
}

function bindAll(obj, ctx) {
  return Object.keys(obj).reduce(
    function(acc, k) { acc[k] = obj[k].bind(ctx); return acc; }, {});
}

// FSM library (embedded here for portability purposes)

function FSM() {}

FSM.prototype = assign(FSM.prototype, {
  start: function() {
    this.runState(this.initialState);
    return this;
  },
  send: function(input) {
    var args = Array.prototype.slice.call(arguments, 1),
        currentState = this.getCurrentState(),
        nextState = this.getNextState(currentState, input);
    return nextState? this.runState(nextState, args) : void 0;
  },
  runState: function(nextState, args) {
    // console.log(@~'#[FSM] ${this.getCurrentState()} -> ${nextState}');
    this.changed = false;
    if (!(args instanceof Array)) { args = [args]; }
    this.onStateChange(this.currentState, nextState, args);
    if (this.states[nextState]) {
      this.states[nextState].apply(this, args || []);
    }
    if (!this.changed) {
      this.changed = true;
      this.setCurrentState(nextState);
    }
  },
  onStateChange: function(state, nextState, args) {
    // nop
  },
  getNextState: function(currentState, input) {
    try {
      return this.transitions[currentState][input];
    } catch (e) {
      return undefined;
    }
  },
  getCurrentState: function() {
    return this._currentState;
  },
  setCurrentState: function(state) {
    this._currentState = state;
  }
});

// Touch handling utilities

function clone(touches) {
  var copy = [{
    screenX: touches[0].screenX,
    screenY: touches[0].screenY
  }];
  if (touches[1]) {
    copy.push({
      screenX: touches[1].screenX,
      screenY: touches[1].screenY
    });
  }
  return copy;
}

function calculatePosition(reference, touches) {
  var ref = calculateCenter(reference),
      actual = calculateCenter(touches);
  return {x: actual.x - ref.x, y: actual.y - ref.y};
}

function calculateZoom(reference, touches) {
  var ref = calculateDistance(reference),
      actual = calculateDistance(touches),
      zoom = (actual - ref) / 100;
  return {x: zoom, y: zoom};
}

function calculateDistance(touches) {
  return Math.sqrt(
    Math.pow(touches[0].screenX - touches[1].screenX, 2) +
      Math.pow(touches[0].screenY - touches[1].screenY, 2)
  );
}

function calculateCenter(touches) {
  return {
    x: (touches[0].screenX + touches[1].screenX) / 2,
    y: (touches[0].screenY + touches[1].screenY) / 2
  };
}

function calculateDelta(touch0, touch1) {
  return {
    x: touch1.screenX - touch0.screenX,
    y: touch1.screenY - touch0.screenY
  };
}

function calculateSpeed(distance, time) {
  return distance / time;
}

function fireOriginalEvent(origE) {
  var e = new CustomEvent('touchstart', origE);
  e.touches = Array.prototype.slice(origE.touches);
  origE.srcElement.dispatchEvent(e);
  // e = new CustomEvent('click', origE);
  // origE.srcElement.dispatchEvent(e);
}

function fireClickEvent(origE) {
  var e = new CustomEvent('click', origE);
  origE.srcElement.dispatchEvent(e);
}

// The State Machine

var TouchDaemon = assign({}, FSM.prototype, {
  // remove this method to reuse the library
  emit: function(event, e, params) {
      e = e? {srcElement: e.srcElement, target: e.currentTarget,
              originalEvent: e} : {};
    // HEY! USER! What do you want to do with the event?
    // doWhateverYouNeed(event, e, params);
  },
  start: function() {
    this.handlers = bindAll(this.handlers, this);
    this.setListeners();
    return FSM.prototype.start.call(this);
  },
  stop: function() {
  },
  setListeners: function() {
    document.body.addEventListener('touchstart', this.handlers.onTouchstart, true);
    document.body.addEventListener('touchend', this.handlers.onTouchend, true);
    document.body.addEventListener('touchmove', this.handlers.onTouchmove, true);
  },
  removeListeners: function() {
    document.body.removeEventListener('touchstart', this.handlers.onTouchstart, true);
    document.body.removeEventListener('touchend', this.handlers.onTouchend, true);
    document.body.removeEventListener('touchmove', this.handlers.onTouchmove, true);
  },
  initialState: '@waiting',
  onStateChange: function() {
    window.clearTimeout(this.timerId);
    this.timerId = window.setTimeout(this.handlers.onTimeout, this.timeout);
  },
  handlers: {
    onTouchstart: function(e) {
      e.stopPropagation();
      if (e.touches.length === 1) {
        // calculate drag threshold
        this._movedRef = clone(e.touches);
        this._refDistance = 0;
        this.send('FIRST_FINGER_DOWN', e);
      } else if (e.touches.length === 2) {
        this.send('SECOND_FINGER_DOWN', e);
      }
    },
    onTouchend: function(e) {
      if (e.changedTouches.length === 2) {
        this.send('TOUCH_END_BOTH_FINGERS', e);
      } else if (e.touches.length === 1) {
        this.send('TOUCH_END_SECOND_FINGER', e);
      } else {
        this.send('TOUCH_END_FIRST_FINGER', e);
      }
    },
    onTouchmove: function(e) {
      if (this._refDistance > configConstants.dragThreshold) {
        this.send('TOUCH_MOVE', e);
      } else {
        this._refDistance += calculateDistance([e.touches[0],
                                                this._movedRef[0]]);
      }
    },
    onTimeout: function() {
      this.send('TIME_OUT');
    },
    idle: function() {}
  },
  states: {
    '@waiting': function() {
      this.reference = null;
      this.lastState = null;
      this.refEvent = null;
    },
    '@hold': function(e) {
      this.emit('touch', e);
      this.refEvent = e;
    },
    '@dragstart': function(e) {
      this.reference = clone(e.touches);
      this.lastState = {delta: {x: 0, y: 0}, speed: 0, stamp: Date.now(),
                        touches: clone(e.touches)};
      this.emit('dragstart', e);
      this.runState('@drag', e);
    },
    '@drag': function(e) {
      // TO THINK: Or should I emit the WHOLE distance, from this.reference?
      var distance = calculateDistance([e.touches[0], this.lastState.touches[0]]),
          now = Date.now(),
          delta = calculateDelta(this.lastState.touches[0], e.touches[0]),
          totalDelta = calculateDelta(this.reference[0],
                                      this.lastState.touches[0]),
          totalDistance = calculateDistance([this.reference[0],
                                             this.lastState.touches[0]]),
          speed = calculateSpeed(distance, now - this.lastState.stamp);
      this.emit('drag', e, {delta: delta, totalDelta: totalDelta,
                            speed: speed, totalDistance: totalDistance});
      this.lastState = {delta: delta, distance: distance, speed: speed,
                        stamp: now, touches: clone(e.touches)};
    },
    '@swipe': function(e) {
      var totalDistance = calculateDistance([this.reference[0],
                                             this.lastState.touches[0]]),
          totalDelta = calculateDelta(this.reference[0],
                                      this.lastState.touches[0]),
          directionRatio = Math.abs(totalDelta.x / (totalDelta.y || 0.01));
      // Possible conditions to try: total distance, last distance, speed
      // TODO: remove this comment if the condition works well
      if (this.lastState.speed > this.swipeSpeedThreshold) {
        if (directionRatio > 2) {
          this.emit(totalDelta.x > 0? 'swipe:right' : 'swipe:left', e,
                    {distance: Math.abs(totalDelta.x),
                     speed: this.lastState.speed});
        } else if (directionRatio < 0.5) {
          this.emit(totalDelta.y > 0? 'swipe:down' : 'swipe:up', e,
                    {distance: Math.abs(totalDelta.y),
                     speed: this.lastState.speed});
        }
        this.emit('swipe', e, {delta: totalDelta, distance: totalDistance,
                               speed: this.lastState.speed});
      }
      this.runState('@dragend', e);
    },
    '@dragend': function(e) {
      this.emit('dragend', e);
      this.runState('@waiting');
    },
    '@twofingers': function(e) {
      // no-op
    },
    '@redispatch': function() {
      this.runState('@waiting');
    },
    '@redispatch:click': function(e) {
      this.removeListeners();
      fireOriginalEvent(this.refEvent);
      this.setListeners();
      this.emit('tap', e);
      this.runState('@cooldown');
    },
    '@pinchstart': function(e) {
      this.emit('pinchstart', e);
      this.runState('@pinch', e);
    },
    '@pinch': function(e) {
      // pending
    },
    '@cooldown': function() {
      // no-op
    },
    '@taptwo': function(e) {
      this.emit('taptwo', e);
      this.runState('@waiting');
    }
  },
  transitions: {
    '@waiting': {
      'FIRST_FINGER_DOWN': '@hold',
      'SECOND_FINGER_DOWN': '@twofingers'
    },
    '@hold': {
      'SECOND_FINGER_DOWN': '@twofingers',
      // 'TIME_OUT': '@redispatch',
      'TOUCH_MOVE': '@dragstart',
      'TOUCH_END_FIRST_FINGER': '@redispatch:click'
    },
    '@drag': {
      'SECOND_FINGER_DOWN': '@cooldown',
      'TOUCH_END_FIRST_FINGER': '@swipe',
      'TOUCH_MOVE': '@drag'
    },
    '@twofingers': {
      'TOUCH_MOVE': '@pinchstart',
      'TOUCH_END_SECOND_FINGER': '@ready',
      'TOUCH_END_BOTH_FINGERS': '@taptwo',
      'TIME_OUT': '@waiting'
    },
    '@dragend': {
      'TIME_OUT': '@waiting'
    },
    '@pinch': {
      'TOUCH_MOVE': '@pinch',
      'TOUCH_END_FIRST_FINGER': '@waiting',
      'TOUCH_END_SECOND_FINGER': '@waiting',
      'TOUCH_END_BOTH_FINGERS': '@waiting'
    },
    '@ready': {
      'TIME_OUT': '@redispatch',
      'TOUCH_END_FIRST_FINGER': '@taptwo'
    },
    '@cooldown': {
      'TIME_OUT': '@waiting'
    }
  }
}, configConstants);

// Let's GO!

if (typeof module !== 'undefined')
  module.exports = TouchDaemon.start();
