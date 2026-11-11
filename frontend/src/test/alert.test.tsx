import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Alert } from '../components/ui/Alert';

describe('Alert Component', () => {
  it('renders title and message content', () => {
    render(
      <Alert variant="error" title="Access Denied">
        You do not have permission to view this resource.
      </Alert>
    );
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText(/permission to view this resource/i)).toBeInTheDocument();
  });

  it('calls onClose callback when dismiss button clicked', () => {
    const handleClose = vi.fn();
    render(
      <Alert variant="info" onClose={handleClose}>
        System notification
      </Alert>
    );
    const closeBtn = screen.getByLabelText(/dismiss alert/i);
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});

