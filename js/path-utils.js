const APP_BASE_PATH = (() => {
    if (typeof window === 'undefined' || !window.location?.pathname) {
        return '/';
    }

    const pathname = window.location.pathname;
    const segments = pathname.split('/').filter(Boolean);

    if (segments.length === 0) {
        return '/';
    }

    const repoSegment = segments[0];
    const isLikelySubfolder = pathname.includes(`/${repoSegment}/`) || pathname.endsWith(`/${repoSegment}`);

    if (isLikelySubfolder && repoSegment !== 'dashboard' && repoSegment !== 'surat-masuk' && repoSegment !== 'surat-keluar') {
        return `/${repoSegment}/`;
    }

    return '/';
})();

export function getAppBasePath() {
    return APP_BASE_PATH;
}

export function resolveAppPath(path) {
    if (!path) return path;

    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('mailto:') || path.startsWith('tel:') || path.startsWith('javascript:')) {
        return path;
    }

    if (path.startsWith('#') || path.startsWith('?')) {
        return path;
    }

    const normalized = path.trim();
    if (normalized === '/') {
        return getAppBasePath();
    }

    if (normalized.startsWith('/')) {
        return `${getAppBasePath()}${normalized.replace(/^\//, '')}`;
    }

    return normalized;
}

export function navigateToAppPath(path, replace = false) {
    const resolvedPath = resolveAppPath(path);
    if (replace) {
        window.location.replace(resolvedPath);
    } else {
        window.location.href = resolvedPath;
    }
}

export default {
    getAppBasePath,
    resolveAppPath,
    navigateToAppPath
};
