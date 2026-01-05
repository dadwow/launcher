/**
 * Button Feedback System Tests
 * Tests for loading states and user feedback on buttons
 * @jest-environment jsdom
 */

describe('Button Feedback System Tests', () => {
    let mockButton;
    let mockTextSpan;

    beforeEach(() => {
        // Create mock button with text span
        mockTextSpan = {
            textContent: 'Install',
            style: {}
        };

        mockButton = {
            id: 'test-button',
            dataset: {},
            classList: {
                classes: [],
                add: jest.fn(function (className) {
                    this.classes.push(className);
                }),
                remove: jest.fn(function (className) {
                    this.classes = this.classes.filter(c => c !== className);
                }),
                contains: jest.fn(function (className) {
                    return this.classes.includes(className);
                })
            },
            disabled: false,
            querySelector: jest.fn(() => mockTextSpan)
        };

        document.getElementById = jest.fn(() => mockButton);
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('should add loading state to button', () => {
        const setButtonLoading = (buttonId, loading = true) => {
            const button = document.getElementById(buttonId);
            if (button) {
                if (loading) {
                    const textSpan = button.querySelector('.btn-text');
                    if (textSpan && !button.dataset.originalText) {
                        button.dataset.originalText = textSpan.textContent;
                    }
                    button.classList.add('btn-loading');
                    button.disabled = true;
                } else {
                    button.classList.remove('btn-loading');
                    button.disabled = false;
                }
            }
        };

        setButtonLoading('test-button', true);

        expect(mockButton.classList.add).toHaveBeenCalledWith('btn-loading');
        expect(mockButton.disabled).toBe(true);
        expect(mockButton.dataset.originalText).toBe('Install');
    });

    test('should remove loading state from button', () => {
        const setButtonLoading = (buttonId, loading = true) => {
            const button = document.getElementById(buttonId);
            if (button) {
                if (loading) {
                    button.classList.add('btn-loading');
                    button.disabled = true;
                } else {
                    button.classList.remove('btn-loading');
                    button.disabled = false;
                }
            }
        };

        mockButton.classList.classes.push('btn-loading');
        mockButton.disabled = true;

        setButtonLoading('test-button', false);

        expect(mockButton.classList.remove).toHaveBeenCalledWith('btn-loading');
        expect(mockButton.disabled).toBe(false);
    });

    test('should show success feedback on button', () => {
        const setButtonFeedback = (buttonId, message, type = 'success', duration = 2000) => {
            const button = document.getElementById(buttonId);
            if (!button) return;

            const textSpan = button.querySelector('.btn-text');
            if (textSpan) {
                if (!button.dataset.originalText) {
                    button.dataset.originalText = textSpan.textContent;
                }

                textSpan.textContent = message;
                button.classList.remove('btn-feedback-success', 'btn-feedback-error');
                button.classList.add(`btn-feedback-${type}`);

                setTimeout(() => {
                    if (button.dataset.originalText) {
                        textSpan.textContent = button.dataset.originalText;
                        button.classList.remove(`btn-feedback-${type}`);
                        delete button.dataset.originalText;
                    }
                }, duration);
            }
        };

        setButtonFeedback('test-button', 'Saved!', 'success', 2000);

        expect(mockTextSpan.textContent).toBe('Saved!');
        expect(mockButton.classList.add).toHaveBeenCalledWith('btn-feedback-success');

        // Fast forward time
        jest.advanceTimersByTime(2000);

        expect(mockTextSpan.textContent).toBe('Install');
        expect(mockButton.classList.remove).toHaveBeenCalledWith('btn-feedback-success');
    });

    test('should show error feedback on button', () => {
        const setButtonFeedback = (buttonId, message, type = 'success', duration = 2000) => {
            const button = document.getElementById(buttonId);
            if (!button) return;

            const textSpan = button.querySelector('.btn-text');
            if (textSpan) {
                if (!button.dataset.originalText) {
                    button.dataset.originalText = textSpan.textContent;
                }

                textSpan.textContent = message;
                button.classList.add(`btn-feedback-${type}`);

                setTimeout(() => {
                    if (button.dataset.originalText) {
                        textSpan.textContent = button.dataset.originalText;
                        button.classList.remove(`btn-feedback-${type}`);
                        delete button.dataset.originalText;
                    }
                }, duration);
            }
        };

        setButtonFeedback('test-button', 'Failed!', 'error', 2000);

        expect(mockTextSpan.textContent).toBe('Failed!');
        expect(mockButton.classList.add).toHaveBeenCalledWith('btn-feedback-error');

        jest.advanceTimersByTime(2000);

        expect(mockTextSpan.textContent).toBe('Install');
    });

    test('should handle missing button gracefully', () => {
        document.getElementById = jest.fn(() => null);

        const setButtonLoading = (buttonId, _loading = true) => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.classList.add('btn-loading');
            }
        };

        expect(() => {
            setButtonLoading('nonexistent-button', true);
        }).not.toThrow();
    });

    test('should restore original text after multiple feedback calls', () => {
        const setButtonFeedback = (buttonId, message, type = 'success', duration = 1000) => {
            const button = document.getElementById(buttonId);
            if (!button) return;

            const textSpan = button.querySelector('.btn-text');
            if (textSpan) {
                if (!button.dataset.originalText) {
                    button.dataset.originalText = textSpan.textContent;
                }

                textSpan.textContent = message;
                button.classList.add(`btn-feedback-${type}`);

                setTimeout(() => {
                    if (button.dataset.originalText) {
                        textSpan.textContent = button.dataset.originalText;
                        button.classList.remove(`btn-feedback-${type}`);
                        delete button.dataset.originalText;
                    }
                }, duration);
            }
        };

        // First feedback
        setButtonFeedback('test-button', 'Saved!', 'success', 1000);
        expect(mockTextSpan.textContent).toBe('Saved!');

        jest.advanceTimersByTime(1000);
        expect(mockTextSpan.textContent).toBe('Install');

        // Second feedback
        setButtonFeedback('test-button', 'Updated!', 'success', 1000);
        expect(mockTextSpan.textContent).toBe('Updated!');

        jest.advanceTimersByTime(1000);
        expect(mockTextSpan.textContent).toBe('Install');
    });
});
