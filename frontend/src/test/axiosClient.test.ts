import { describe, it, expect } from 'vitest';
import { getErrorMessage } from '../api/axiosClient';
import { AxiosError } from 'axios';

describe('getErrorMessage Utility', () => {
  it('extracts string detail from FastAPI response', () => {
    const error = new AxiosError('Bad Request');
    error.response = {
      data: { detail: 'Invalid credentials provided.' },
      status: 401,
      statusText: 'Unauthorized',
      headers: {},
      config: {} as any,
    };
    expect(getErrorMessage(error)).toBe('Invalid credentials provided.');
  });

  it('joins array validation error messages from Pydantic', () => {
    const error = new AxiosError('Unprocessable Entity');
    error.response = {
      data: {
        detail: [
          { msg: 'Field required', loc: ['body', 'email'] },
          { msg: 'String too short', loc: ['body', 'password'] },
        ],
      },
      status: 422,
      statusText: 'Unprocessable Entity',
      headers: {},
      config: {} as any,
    };
    expect(getErrorMessage(error)).toBe('Field required, String too short');
  });

  it('provides friendly network connection error', () => {
    const error = new AxiosError('Network Error');
    expect(getErrorMessage(error)).toContain('Unable to connect to the backend server');
  });
});

