import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import InterviewsList from '../components/InterviewsList';
import { useUser } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

// Mock dependencies
vi.mock('@clerk/nextjs', () => ({
  useUser: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(({ queryKey }) => {
    // First call is for companies, second for stages, third for interviews
    if (queryKey[0] === 'companies') {
      return { data: [], isLoading: false, error: null };
    }
    if (queryKey[0] === 'stages') {
      return {
        data: [
          { id: 1, stage: 'Phone Screen' },
          { id: 2, stage: 'Technical' },
          { id: 3, stage: 'Final' },
        ],
        isLoading: false,
        error: null,
      };
    }
    // Default for interviews query
    return { data: [], isLoading: false, error: null };
  }),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
  })),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/lib/store', () => ({
  useAppStore: (selector: any) => {
    const state = {
      filteredDate: null,
      setFilteredDate: vi.fn(),
      filteredCompany: null,
      setFilteredCompany: vi.fn(),
    };
    return selector(state);
  },
}));

vi.mock('@/lib/guestStorage', () => ({
  listGuestInterviews: vi.fn(() => []),
  removeGuestInterview: vi.fn(),
}));

describe('InterviewsList Component', () => {
  const mockRouter = {
    refresh: vi.fn(),
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue(mockRouter);
    (useUser as any).mockReturnValue({ user: { id: 'test-user-id' } });
  });

  it('should render "No Interviews scheduled" when there are no interviews', async () => {
    (useQuery as any).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    render(<InterviewsList />);

    await waitFor(() => {
      expect(screen.getByText('No Interviews scheduled')).toBeInTheDocument();
    });
  });

  it('should render list of interviews when data is available', async () => {
    const mockInterviews = [
      {
        id: '1',
        jobTitle: 'Senior Frontend Engineer',
        date: new Date('2025-12-01T10:00:00'),
        stage: { stage: 'Phone Screen' },
        stageMethod: { method: 'Phone' },
        company: { name: 'Tech Corp', id: 1 },
        outcome: 'SCHEDULED',
        link: null,
        clientCompany: null,
        jobPostingLink: null,
        metadata: null,
      },
      {
        id: '2',
        jobTitle: 'Backend Developer',
        date: new Date('2025-12-05T14:00:00'),
        stage: { stage: 'Technical' },
        stageMethod: { method: 'Link' },
        company: { name: 'Software Inc', id: 2 },
        outcome: 'SCHEDULED',
        link: 'https://meet.google.com/abc',
        clientCompany: null,
        jobPostingLink: null,
        metadata: null,
      },
    ];

    (useQuery as any).mockReturnValue({
      data: mockInterviews,
      isLoading: false,
      error: null,
    });

    render(<InterviewsList />);

    await waitFor(() => {
      expect(screen.getByText(/Senior Frontend Engineer.*Tech Corp/)).toBeInTheDocument();
      expect(screen.getByText(/Backend Developer.*Software Inc/)).toBeInTheDocument();
    });
  });

  it.skip('should show progress dialog when progress button is clicked', async () => {
    const user = userEvent.setup();
    const mockInterviews = [
      {
        id: '1',
        jobTitle: 'Senior Frontend Engineer',
        date: new Date('2025-12-01T10:00:00'),
        stage: { stage: 'Phone Screen' },
        stageMethod: { method: 'Phone' },
        company: { name: 'Tech Corp', id: 1 },
        outcome: 'SCHEDULED',
        link: null,
        clientCompany: null,
        jobPostingLink: null,
        metadata: null,
      },
    ];

    (useQuery as any).mockReturnValue({
      data: mockInterviews,
      isLoading: false,
      error: null,
    });

    render(<InterviewsList />);

    await waitFor(() => {
      expect(screen.getByText(/Senior Frontend Engineer/)).toBeInTheDocument();
    });

    // Find and click the progress button (CornerUpRight icon button)
    const progressButtons = screen.getAllByRole('button');
    const progressButton = progressButtons.find((btn) =>
      btn.querySelector('svg') // Find button with SVG (icon button)
    );

    if (progressButton) {
      await user.click(progressButton);

      await waitFor(() => {
        expect(screen.getByText(/Progress Interview/)).toBeInTheDocument();
      });
    }
  });
});