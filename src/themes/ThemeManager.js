import lightTheme from './light.js';
import darkTheme from './dark.js';

class ThemeManager {
    constructor() {
        this.themes = {
            light: lightTheme,
            dark: darkTheme
        };
        
        this.activeThemeName = 'light';
        this.activeTheme = this.themes.light;
        this.observers = new Set();
        this.mutationObserver = null;
    }

    getTheme() {
        return this.activeTheme;
    }

    getThemeName() {
        return this.activeThemeName;
    }

    getColor(path) {
        const parts = path.split('.');
        let value = this.activeTheme.colors;
        
        for (const part of parts) {
            if (value && typeof value === 'object' && part in value) {
                value = value[part];
            } else {
                return null;
            }
        }
        
        return value;
    }

    getPalette() {
        return this.activeTheme.palette || [];
    }

    getPaletteColor(index) {
        const palette = this.getPalette();
        return palette[index % palette.length];
    }

    setTheme(themeName) {
        if (!this.themes[themeName]) {
            return false;
        }

        if (themeName === this.activeThemeName) {
            return false;
        }

        this.activeThemeName = themeName;
        this.activeTheme = this.themes[themeName];
        
        this._notifyObservers();
        
        return true;
    }

    registerTheme(name, theme) {
        this.themes[name] = theme;
    }

    detectTheme() {
        if (typeof document !== 'undefined') {
            if (document.documentElement.classList.contains('dark') || 
                    document.body.classList.contains('dark')) {
                return 'dark';
            }
        }
        
        if (typeof window !== 'undefined' && window.matchMedia) {
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                return 'dark';
            }
        }
        
        return 'light';
    }

    autoDetect() {
        const detected = this.detectTheme();
        return this.setTheme(detected);
    }

    subscribe(callback) {
        this.observers.add(callback);
        return () => this.observers.delete(callback);
    }

    watchForChanges(onChange) {
        if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
            return;
        }

        this.stopWatching();

        const checkAndUpdate = () => {
            const detected = this.detectTheme();
            if (detected !== this.activeThemeName) {
                this.setTheme(detected);
                if (onChange) {
                    onChange(detected);
                }
            }
        };

        this.mutationObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    checkAndUpdate();
                    break;
                }
            }
        });

        this.mutationObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class']
        });

        if (document.body) {
            this.mutationObserver.observe(document.body, {
                attributes: true,
                attributeFilter: ['class']
            });
        }

        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            this._mediaQueryHandler = () => checkAndUpdate();
            
            if (mediaQuery.addEventListener) {
                mediaQuery.addEventListener('change', this._mediaQueryHandler);
            } else if (mediaQuery.addListener) {
                mediaQuery.addListener(this._mediaQueryHandler);
            }
        }
    }

    stopWatching() {
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
            this.mutationObserver = null;
        }

        if (this._mediaQueryHandler && window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            if (mediaQuery.removeEventListener) {
                mediaQuery.removeEventListener('change', this._mediaQueryHandler);
            } else if (mediaQuery.removeListener) {
                mediaQuery.removeListener(this._mediaQueryHandler);
            }
            this._mediaQueryHandler = null;
        }
    }

    isDarkMode() {
        return this.activeThemeName === 'dark';
    }

    _notifyObservers() {
        for (const callback of this.observers) {
            try {
                callback(this.activeTheme, this.activeThemeName);
            } catch (error) {
                // swallow observer errors
            }
        }
    }

    getAllColors() {
        return { ...this.activeTheme.colors };
    }

    destroy() {
        this.stopWatching();
        this.observers.clear();
    }
}

export const themeManager = new ThemeManager();
export { ThemeManager };
export default themeManager;
