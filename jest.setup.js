import '@testing-library/jest-dom';

global.localStorage = {
  getItem: jest.fn(() => null),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

global.window = {
  electronAPI: {
    showOpenDialog: jest.fn(),
    navigate: jest.fn(),
  },
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
};