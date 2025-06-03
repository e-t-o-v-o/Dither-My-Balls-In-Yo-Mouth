import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Input tab', () => {
  render(<App />);
  const inputTab = screen.getByText(/Input/);
  expect(inputTab).toBeInTheDocument();
});
