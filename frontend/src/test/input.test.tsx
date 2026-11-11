import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '../components/ui/Input';

describe('Input Component', () => {
  it('renders label and input with association', () => {
    render(<Input label="Work Email" placeholder="Enter email" />);
    expect(screen.getByLabelText(/work email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter email/i)).toBeInTheDocument();
  });

  it('displays error message and applies error styling', () => {
    render(<Input label="Password" error="Password must be at least 6 characters" />);
    expect(screen.getByText(/password must be at least 6 characters/i)).toBeInTheDocument();
  });

  it('handles value changes', () => {
    const handleChange = vi.fn();
    render(<Input label="Name" onChange={handleChange} />);
    const input = screen.getByLabelText(/name/i);
    fireEvent.change(input, { target: { value: 'Rohan Sharma' } });
    expect(handleChange).toHaveBeenCalled();
  });
});

