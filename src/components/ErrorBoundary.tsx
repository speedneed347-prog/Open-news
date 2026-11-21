import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'An unexpected rendering error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ALL INFORMATION HUB ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6] dark:bg-[#0C0F14] p-6">
          <div className="max-w-lg w-full border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] p-8">
            <p className="text-xs uppercase tracking-widest text-[#57534E] dark:text-[#9CA3AF]">
              ALL INFORMATION HUB
            </p>
            <h1 className="font-serif text-2xl font-semibold mt-2 text-[#141413] dark:text-[#F3F4F6]">
              Something went wrong while loading this section
            </h1>
            <p className="text-sm text-[#57534E] dark:text-[#9CA3AF] mt-3 break-words font-mono">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.href = '/';
              }}
              className="mt-6 px-5 py-2.5 text-sm font-medium bg-[#141413] text-white dark:bg-[#F3F4F6] dark:text-[#141413] hover:opacity-90 transition-opacity"
            >
              Return to Front Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
