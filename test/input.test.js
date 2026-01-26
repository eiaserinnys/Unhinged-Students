/**
 * Input System Tests
 *
 * Tests for the input handling system including:
 * - Keyboard input
 * - Mouse input
 * - Touch input
 * - Helper functions
 */

// Input state object (recreated for testing)
const Input = {
  keys: {},
  keysJustPressed: {},
  keysPrevious: {},
  mouse: {
    x: 0,
    y: 0,
    pressed: false,
    button: -1,
  },
  touch: {
    x: 0,
    y: 0,
    active: false,
  },
};

// Helper functions
function isKeyPressed(key) {
  return Input.keys[key.toLowerCase()] === true;
}

function isKeyJustPressed(key) {
  return Input.keysJustPressed[key.toLowerCase()] === true;
}

function isMousePressed() {
  return Input.mouse.pressed;
}

function getMousePosition() {
  return { x: Input.mouse.x, y: Input.mouse.y };
}

function isTouchActive() {
  return Input.touch.active;
}

function getTouchPosition() {
  return { x: Input.touch.x, y: Input.touch.y };
}

function updateInput() {
  for (const key in Input.keys) {
    Input.keysJustPressed[key] = Input.keys[key] && !Input.keysPrevious[key];
  }
  Input.keysPrevious = { ...Input.keys };
}

// Reset input state before each test
function resetInput() {
  Input.keys = {};
  Input.keysJustPressed = {};
  Input.keysPrevious = {};
  Input.mouse = { x: 0, y: 0, pressed: false, button: -1 };
  Input.touch = { x: 0, y: 0, active: false };
}

describe('Input System', () => {
  beforeEach(() => {
    resetInput();
  });

  describe('Input object structure', () => {
    test('should have keys object', () => {
      expect(Input.keys).toBeDefined();
      expect(typeof Input.keys).toBe('object');
    });

    test('should have mouse object with correct properties', () => {
      expect(Input.mouse).toBeDefined();
      expect(Input.mouse.x).toBe(0);
      expect(Input.mouse.y).toBe(0);
      expect(Input.mouse.pressed).toBe(false);
      expect(Input.mouse.button).toBe(-1);
    });

    test('should have touch object with correct properties', () => {
      expect(Input.touch).toBeDefined();
      expect(Input.touch.x).toBe(0);
      expect(Input.touch.y).toBe(0);
      expect(Input.touch.active).toBe(false);
    });
  });
});

describe('Keyboard Input', () => {
  beforeEach(() => {
    resetInput();
  });

  describe('isKeyPressed', () => {
    test('should return false for unpressed key', () => {
      expect(isKeyPressed('a')).toBe(false);
    });

    test('should return true for pressed key', () => {
      Input.keys['a'] = true;
      expect(isKeyPressed('a')).toBe(true);
    });

    test('should be case insensitive', () => {
      Input.keys['a'] = true;
      expect(isKeyPressed('A')).toBe(true);
    });

    test('should handle arrow keys', () => {
      Input.keys['arrowup'] = true;
      expect(isKeyPressed('arrowup')).toBe(true);
      expect(isKeyPressed('ArrowUp')).toBe(true);
    });

    test('should handle space key', () => {
      Input.keys[' '] = true;
      expect(isKeyPressed(' ')).toBe(true);
    });
  });

  describe('isKeyJustPressed', () => {
    test('should return false for never pressed key', () => {
      expect(isKeyJustPressed('a')).toBe(false);
    });

    test('should return true for newly pressed key', () => {
      Input.keys['a'] = true;
      updateInput();
      expect(isKeyJustPressed('a')).toBe(true);
    });

    test('should return false for held key (second frame)', () => {
      Input.keys['a'] = true;
      updateInput(); // First frame - just pressed
      updateInput(); // Second frame - held
      expect(isKeyJustPressed('a')).toBe(false);
    });

    test('should be case insensitive', () => {
      Input.keys['q'] = true;
      updateInput();
      expect(isKeyJustPressed('Q')).toBe(true);
    });
  });

  describe('updateInput', () => {
    test('should update keysJustPressed correctly', () => {
      Input.keys['w'] = true;
      updateInput();

      expect(Input.keysJustPressed['w']).toBe(true);
    });

    test('should copy current keys to previous', () => {
      Input.keys['e'] = true;
      updateInput();

      expect(Input.keysPrevious['e']).toBe(true);
    });

    test('should detect key release and re-press', () => {
      // Press key
      Input.keys['r'] = true;
      updateInput();
      expect(isKeyJustPressed('r')).toBe(true);

      // Hold key
      updateInput();
      expect(isKeyJustPressed('r')).toBe(false);

      // Release key
      Input.keys['r'] = false;
      updateInput();

      // Re-press key
      Input.keys['r'] = true;
      updateInput();
      expect(isKeyJustPressed('r')).toBe(true);
    });
  });
});

describe('Mouse Input', () => {
  beforeEach(() => {
    resetInput();
  });

  describe('isMousePressed', () => {
    test('should return false when not pressed', () => {
      expect(isMousePressed()).toBe(false);
    });

    test('should return true when pressed', () => {
      Input.mouse.pressed = true;
      expect(isMousePressed()).toBe(true);
    });
  });

  describe('getMousePosition', () => {
    test('should return current mouse position', () => {
      Input.mouse.x = 100;
      Input.mouse.y = 200;

      const pos = getMousePosition();

      expect(pos.x).toBe(100);
      expect(pos.y).toBe(200);
    });

    test('should return object with x and y', () => {
      const pos = getMousePosition();

      expect(pos).toHaveProperty('x');
      expect(pos).toHaveProperty('y');
    });
  });

  describe('mouse state', () => {
    test('should track mouse button', () => {
      Input.mouse.button = 0; // Left click
      expect(Input.mouse.button).toBe(0);

      Input.mouse.button = 2; // Right click
      expect(Input.mouse.button).toBe(2);
    });

    test('should reset button on release', () => {
      Input.mouse.pressed = true;
      Input.mouse.button = 0;

      // Simulate release
      Input.mouse.pressed = false;
      Input.mouse.button = -1;

      expect(Input.mouse.button).toBe(-1);
    });
  });
});

describe('Touch Input', () => {
  beforeEach(() => {
    resetInput();
  });

  describe('isTouchActive', () => {
    test('should return false when no touch', () => {
      expect(isTouchActive()).toBe(false);
    });

    test('should return true when touching', () => {
      Input.touch.active = true;
      expect(isTouchActive()).toBe(true);
    });
  });

  describe('getTouchPosition', () => {
    test('should return current touch position', () => {
      Input.touch.x = 150;
      Input.touch.y = 250;

      const pos = getTouchPosition();

      expect(pos.x).toBe(150);
      expect(pos.y).toBe(250);
    });

    test('should return object with x and y', () => {
      const pos = getTouchPosition();

      expect(pos).toHaveProperty('x');
      expect(pos).toHaveProperty('y');
    });
  });
});

describe('Movement Keys', () => {
  beforeEach(() => {
    resetInput();
  });

  test('should detect arrow keys for movement', () => {
    Input.keys['arrowup'] = true;
    Input.keys['arrowdown'] = false;
    Input.keys['arrowleft'] = false;
    Input.keys['arrowright'] = true;

    expect(isKeyPressed('arrowup')).toBe(true);
    expect(isKeyPressed('arrowdown')).toBe(false);
    expect(isKeyPressed('arrowleft')).toBe(false);
    expect(isKeyPressed('arrowright')).toBe(true);
  });

  test('should detect skill keys (Q, W, E)', () => {
    Input.keys['q'] = true;
    updateInput();

    expect(isKeyJustPressed('q')).toBe(true);
    expect(isKeyJustPressed('w')).toBe(false);
    expect(isKeyJustPressed('e')).toBe(false);
  });

  test('should detect attack key (Space)', () => {
    Input.keys[' '] = true;
    expect(isKeyPressed(' ')).toBe(true);
  });
});

describe('Multiple Key Presses', () => {
  beforeEach(() => {
    resetInput();
  });

  test('should handle multiple simultaneous key presses', () => {
    Input.keys['arrowup'] = true;
    Input.keys['arrowright'] = true;

    expect(isKeyPressed('arrowup')).toBe(true);
    expect(isKeyPressed('arrowright')).toBe(true);
  });

  test('should handle multiple keys just pressed', () => {
    Input.keys['q'] = true;
    Input.keys['w'] = true;
    updateInput();

    expect(isKeyJustPressed('q')).toBe(true);
    expect(isKeyJustPressed('w')).toBe(true);
  });
});

describe('Edge Cases', () => {
  beforeEach(() => {
    resetInput();
  });

  test('should handle special characters', () => {
    Input.keys['shift'] = true;
    Input.keys['enter'] = true;
    Input.keys['escape'] = true;

    expect(isKeyPressed('shift')).toBe(true);
    expect(isKeyPressed('enter')).toBe(true);
    expect(isKeyPressed('escape')).toBe(true);
  });

  test('should handle undefined keys gracefully', () => {
    expect(isKeyPressed('nonexistent')).toBe(false);
    expect(isKeyJustPressed('nonexistent')).toBe(false);
  });

  test('should handle number keys', () => {
    Input.keys['1'] = true;
    Input.keys['2'] = true;

    expect(isKeyPressed('1')).toBe(true);
    expect(isKeyPressed('2')).toBe(true);
  });
});
