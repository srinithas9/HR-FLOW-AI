import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../components/ui/Badge';

describe('Badge Component', () => {
  it('renders status text correctly', () => {
    render(<Badge variant="success">Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders dot indicator when dot prop is enabled', () => {
    const { container } = render(<Badge variant="warning" dot>Pending</Badge>);
    const dot = container.querySelector('span.rounded-full');
    expect(dot).toBeInTheDocument();
    expect(dot?.className).toContain('bg-status-warning');
  });

  it('renders brand variant correctly', () => {
    const { container } = render(<Badge variant="brand">Enterprise</Badge>);
    expect(container.firstChild).toHaveClass('text-brand-900');
  });
});

