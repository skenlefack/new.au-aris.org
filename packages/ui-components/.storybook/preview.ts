import type { Preview } from '@storybook/react';
import '../src/styles/globals.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#FAFAFA' },
        { name: 'dark', value: '#1A1A1A' },
        { name: 'aris-green', value: '#E8F5E9' },
      ],
    },
  },
};

export default preview;
