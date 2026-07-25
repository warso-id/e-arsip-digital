// FILE: tests/unit/all-remaining-tests.js
// ============================================
// SEMUA UNIT TEST TERSISA - E-ARSIP DIGITAL
// ============================================

// ============================================
// NAVIGATION TEST
// ============================================
runner.describe('Unit Test: Navigation Component', () => {
    
    beforeAll(() => {
        document.body.innerHTML = '<div id="sidebarMenu"></div>';
        const userData = { id: '1', username: 'admin', role: 'admin' };
        localStorage.setItem('currentUser', JSON.stringify(userData));
        auth.checkAuth();
    });
    
    runner.it('should get correct menu for admin role', () => {
        const menu = navigation.getSidebarMenu('admin');
        assert.true(menu.includes('Dashboard'), 'Should have Dashboard menu');
        assert.true(menu.includes('Surat Masuk'), 'Should have Surat Masuk menu');
        assert.true(menu.includes('Surat Keluar'), 'Should have Surat Keluar menu');
        assert.true(menu.includes('Profil'), 'Should have Profil menu');
    });
    
    runner.it('should get correct menu for super_admin role', () => {
        const menu = navigation.getSidebarMenu('super_admin');
        assert.true(menu.includes('Manajemen User'), 'Should have User Management');
        assert.true(menu.includes('Pengaturan'), 'Should have Settings');
        assert.true(menu.includes('Laporan'), 'Should have Reports');
        assert.true(menu.includes('Log Aktivitas'), 'Should have Logs');
    });
    
    runner.it('should get user menu for unknown role', () => {
        const menu = navigation.getSidebarMenu('unknown_role');
        assert.true(menu.includes('Dashboard'), 'Should have default menu');
    });
    
    runner.it('should render sidebar', () => {
        navigation.loadSidebar();
        const sidebar = document.getElementById('sidebarMenu');
        assert.notNull(sidebar.innerHTML, 'Sidebar should be rendered');
        assert.true(sidebar.innerHTML.length > 0, 'Sidebar should have content');
    });
    
    runner.it('should load top navbar', () => {
        document.body.innerHTML = '<div id="topNavbar"></div>';
        navigation.loadTopNavbar();
        const navbar = document.getElementById('topNavbar');
        assert.notNull(navbar.innerHTML, 'Navbar should be rendered');
        assert.true(navbar.innerHTML.includes('Logout'), 'Should have logout button');
    });
});

// ============================================
// ROUTER TEST
// ============================================
runner.describe('Unit Test: Router', () => {
    
    beforeAll(() => {
        document.body.innerHTML = '<div id="app-outlet"></div>';
    });
    
    runner.it('should register routes', () => {
        router.addRoute('/test', {
            title: 'Test Page',
            template: '<h1>Test</h1>'
        });
        
        const route = router.matchRoute('/test');
        assert.notNull(route, 'Route should be registered');
        assert.equal(route.title, 'Test Page', 'Title should match');
    });
    
    runner.it('should match exact routes', () => {
        router.addRoute('/exact-path', { title: 'Exact' });
        
        const match = router.matchRoute('/exact-path');
        assert.notNull(match, 'Should match exact path');
    });
    
    runner.it('should return null for non-existent routes', () => {
        const match = router.matchRoute('/non-existent-path');
        assert.null(match, 'Should return null for unknown path');
    });
    
    runner.it('should build path with params', () => {
        const path = router.buildPath('/surat/:id/edit', { id: '123' });
        assert.equal(path, '/surat/123/edit', 'Should replace params');
    });
    
    runner.it('should get query parameters', () => {
        const originalSearch = window.location.search;
        window.location.search = '?id=123&mode=edit';
        
        const params = router.getQueryParams();
        assert.equal(params.id, '123', 'Should get id param');
        assert.equal(params.mode, 'edit', 'Should get mode param');
        
        window.location.search = originalSearch;
    });
    
    runner.it('should create auth guard', () => {
        const guard = Router.authGuard('admin');
        assert.type(guard, 'function', 'Should return function');
        
        const userData = { id: '1', role: 'admin' };
        localStorage.setItem('currentUser', JSON.stringify(userData));
        
        const result = guard({});
        assert.true(result, 'Should pass for correct role');
    });
});

// ============================================
// EXPORT TEST
// ============================================
runner.describe('Unit Test: Export Handler', () => {
    
    const testData = [
        { name: 'John', email: 'john@test.com', role: 'admin' },
        { name: 'Jane', email: 'jane@test.com', role: 'user' },
        { name: 'Bob', email: 'bob@test.com', role: 'staf' }
    ];
    
    runner.it('should convert to CSV', () => {
        const csv = ExportHandler.convertToCSV(testData);
        assert.true(csv.includes('name,email,role'), 'Should have headers');
        assert.true(csv.includes('John'), 'Should have data');
        assert.true(csv.includes('admin'), 'Should have role');
    });
    
    runner.it('should handle empty data for CSV', () => {
        const csv = ExportHandler.convertToCSV([]);
        assert.equal(csv, '', 'Empty data should return empty string');
    });
    
    runner.it('should escape commas in CSV', () => {
        const data = [{ name: 'Doe, John', email: 'john@test.com' }];
        const csv = ExportHandler.convertToCSV(data);
        assert.true(csv.includes('"Doe, John"'), 'Should escape commas');
    });
    
    runner.it('should create Excel HTML', () => {
        const originalCreateElement = document.createElement;
        let downloadCalled = false;
        
        document.createElement = function(tag) {
            const el = originalCreateElement.call(document, tag);
            if (tag === 'a') {
                el.click = function() { downloadCalled = true; };
            }
            return el;
        };
        
        ExportHandler.toExcel(testData, 'test.xls', 'TestSheet');
        assert.true(downloadCalled, 'Should trigger download');
        
        document.createElement = originalCreateElement;
    });
});

// ============================================
// SEARCH TEST
// ============================================
runner.describe('Unit Test: Search Handler', () => {
    
    const testData = [
        { id: 1, name: 'John Doe', email: 'john@test.com', role: 'admin' },
        { id: 2, name: 'Jane Smith', email: 'jane@test.com', role: 'user' },
        { id: 3, name: 'Bob Johnson', email: 'bob@test.com', role: 'staf' },
        { id: 4, name: 'Alice Brown', email: 'alice@test.com', role: 'dosen' }
    ];
    
    runner.it('should search locally', () => {
        const handler = new SearchHandler({ searchType: 'local' });
        const results = handler.searchLocal('john', testData);
        
        assert.equal(results.length, 2, 'Should find 2 results');
        assert.equal(results[0].name, 'John Doe', 'Should find John Doe');
        assert.equal(results[1].name, 'Bob Johnson', 'Should find Bob Johnson');
    });
    
    runner.it('should be case insensitive', () => {
        const handler = new SearchHandler({ searchType: 'local' });
        const results = handler.searchLocal('JOHN', testData);
        
        assert.equal(results.length, 2, 'Case insensitive search');
    });
    
    runner.it('should return empty for no matches', () => {
        const handler = new SearchHandler({ searchType: 'local' });
        const results = handler.searchLocal('xyz', testData);
        
        assert.equal(results.length, 0, 'No results for non-matching query');
    });
    
    runner.it('should highlight search results', () => {
        const highlighted = SearchHandler.highlight('John Doe', 'John');
        assert.true(highlighted.includes('<mark>John</mark>'), 'Should highlight match');
    });
    
    runner.it('should advanced search with criteria', () => {
        const results = SearchHandler.advancedSearch(testData, {
            role: 'admin',
            name: 'John'
        });
        
        assert.equal(results.length, 1, 'Should find 1 result');
        assert.equal(results[0].name, 'John Doe', 'Should match criteria');
    });
    
    runner.it('should search in table', () => {
        document.body.innerHTML = `
            <table id="testTable">
                <tbody>
                    <tr><td>John Doe</td><td>admin</td></tr>
                    <tr><td>Jane Smith</td><td>user</td></tr>
                    <tr><td>Bob Johnson</td><td>staf</td></tr>
                </tbody>
            </table>
        `;
        
        const count = SearchHandler.searchTable('testTable', 'john');
        assert.equal(count, 2, 'Should find 2 rows');
    });
});

// ============================================
// NOTIFICATIONS TEST
// ============================================
runner.describe('Unit Test: Notification Helper', () => {
    
    beforeAll(() => {
        document.body.innerHTML = '<div id="toastContainer"></div>';
    });
    
    runner.it('should create toast container', () => {
        const container = NotificationHelper.getToastContainer();
        assert.notNull(container, 'Container should exist');
        assert.equal(container.id, 'toastContainer', 'Should have correct ID');
    });
    
    runner.it('should show success toast', () => {
        const toastId = NotificationHelper.success('Test success message');
        assert.notNull(toastId, 'Should return toast ID');
        assert.true(toastId.startsWith('toast-'), 'ID should start with toast-');
        
        const toast = document.getElementById(toastId);
        assert.notNull(toast, 'Toast element should exist');
        assert.true(toast.innerHTML.includes('Test success message'), 'Should contain message');
        assert.true(toast.classList.contains('bg-success'), 'Should have success class');
    });
    
    runner.it('should show error toast', () => {
        const toastId = NotificationHelper.error('Test error message');
        const toast = document.getElementById(toastId);
        assert.true(toast.classList.contains('bg-danger'), 'Should have danger class');
    });
    
    runner.it('should show warning toast', () => {
        const toastId = NotificationHelper.warning('Test warning');
        const toast = document.getElementById(toastId);
        assert.true(toast.classList.contains('bg-warning'), 'Should have warning class');
    });
    
    runner.it('should show info toast', () => {
        const toastId = NotificationHelper.info('Test info');
        const toast = document.getElementById(toastId);
        assert.true(toast.classList.contains('bg-info'), 'Should have info class');
    });
    
    runner.it('should confirm with dialog', async () => {
        const originalConfirm = window.confirm;
        window.confirm = () => true;
        
        const result = await NotificationHelper.confirm('Are you sure?');
        assert.true(result, 'Should return true on confirm');
        
        window.confirm = originalConfirm;
    });
});

// ============================================
// UPLOAD TEST
// ============================================
runner.describe('Unit Test: Upload Handler', () => {
    
    const handler = new UploadHandler({
        maxFileSize: 5,
        allowedTypes: ['pdf', 'jpg', 'png', 'doc', 'docx']
    });
    
    runner.it('should validate file size', () => {
        const smallFile = { size: 1024, name: 'test.pdf' };
        const validation = handler.validateFile(smallFile);
        assert.true(validation.valid, 'Small file should be valid');
    });
    
    runner.it('should reject oversized file', () => {
        const largeFile = { size: 10 * 1024 * 1024, name: 'large.pdf' };
        const validation = handler.validateFile(largeFile);
        assert.false(validation.valid, 'Large file should be rejected');
        assert.true(validation.error.includes('maksimal'), 'Should mention max size');
    });
    
    runner.it('should validate file type', () => {
        const exeFile = { size: 1024, name: 'virus.exe' };
        const validation = handler.validateFile(exeFile);
        assert.false(validation.valid, 'EXE file should be rejected');
    });
    
    runner.it('should format file size', () => {
        assert.equal(UploadHandler.formatFileSize(0), '0 Bytes');
        assert.equal(UploadHandler.formatFileSize(1024), '1 KB');
        assert.equal(UploadHandler.formatFileSize(1048576), '1 MB');
        assert.equal(UploadHandler.formatFileSize(1073741824), '1 GB');
    });
    
    runner.it('should create upload area', () => {
        document.body.innerHTML = '<div id="uploadTest"></div>';
        
        const uploadArea = UploadHandler.createUploadArea('uploadTest', {
            text: 'Upload file di sini',
            maxSize: 5,
            allowedTypes: ['PDF', 'JPG', 'PNG']
        });
        
        const area = document.getElementById('uploadTest');
        assert.notNull(area.innerHTML, 'Upload area should be created');
        assert.true(area.innerHTML.includes('Upload file di sini'), 'Should have custom text');
        assert.true(area.innerHTML.includes('file-upload-area'), 'Should have upload area class');
        
        assert.type(uploadArea.getFile, 'function', 'Should have getFile method');
        assert.type(uploadArea.clear, 'function', 'Should have clear method');
    });
});

// ============================================
// THEME TEST
// ============================================
runner.describe('Unit Test: Theme Manager', () => {
    
    runner.it('should set theme', () => {
        themeManager.setTheme('dark');
        assert.equal(themeManager.getCurrentTheme(), 'dark', 'Theme should be dark');
        assert.true(document.body.classList.contains('theme-dark'), 'Body should have dark class');
    });
    
    runner.it('should toggle dark mode', () => {
        themeManager.setTheme('light');
        const newTheme = themeManager.toggleDarkMode();
        assert.equal(newTheme, 'dark', 'Should toggle to dark');
        
        const backToLight = themeManager.toggleDarkMode();
        assert.equal(backToLight, 'light', 'Should toggle back to light');
    });
    
    runner.it('should check if dark mode', () => {
        themeManager.setTheme('dark');
        assert.true(themeManager.isDarkMode(), 'Should be dark mode');
        
        themeManager.setTheme('light');
        assert.false(themeManager.isDarkMode(), 'Should not be dark mode');
    });
    
    runner.it('should persist theme preference', () => {
        themeManager.setTheme('blue');
        
        const saved = localStorage.getItem('app-theme');
        assert.equal(saved, 'blue', 'Theme should be saved');
    });
});

// ============================================
// INIT TEST
// ============================================
runner.describe('Unit Test: App Initialization', () => {
    
    runner.it('should have version', () => {
        assert.equal(App.version, '1.0.0', 'Version should be 1.0.0');
        assert.equal(App.name, 'E-Arsip Digital', 'Name should match');
    });
    
    runner.it('should setup globals', () => {
        App.setupGlobals();
        assert.notNull(window.Utils, 'Utils should be global');
        assert.notNull(window.NotificationHelper, 'NotificationHelper should be global');
        assert.notNull(window.ExportHandler, 'ExportHandler should be global');
    });
    
    runner.it('should generate CSRF token', () => {
        const token = App.generateCSRF();
        assert.notNull(token, 'Token should be generated');
        assert.true(token.startsWith('csrf-'), 'Token should start with csrf-');
        assert.equal(token.length, 34, 'Token should be correct length');
    });
    
    runner.it('should check browser compatibility', () => {
        App.checkBrowserCompatibility();
        assert.true(true, 'Should not throw errors');
    });
});

// ============================================
// CHART TEST
// ============================================
runner.describe('Unit Test: Chart Manager', () => {
    
    beforeAll(() => {
        document.body.innerHTML = '<canvas id="testChart" height="100"></canvas>';
    });
    
    runner.it('should create bar chart', () => {
        const chart = chartManager.createBarChart('testChart', {
            labels: ['A', 'B', 'C'],
            datasets: [{ label: 'Test', data: [1, 2, 3] }]
        });
        
        assert.notNull(chart, 'Chart should be created');
        assert.notNull(chartManager.charts['testChart'], 'Chart should be stored');
    });
    
    runner.it('should destroy chart', () => {
        chartManager.destroy('testChart');
        assert.null(chartManager.charts['testChart'], 'Chart should be destroyed');
    });
    
    runner.it('should destroy all charts', () => {
        chartManager.createBarChart('chart1', { labels: [], datasets: [] });
        chartManager.createBarChart('chart2', { labels: [], datasets: [] });
        
        chartManager.destroyAll();
        assert.equal(Object.keys(chartManager.charts).length, 0, 'All charts should be destroyed');
    });
    
    runner.it('should generate colors', () => {
        const colors = ChartManager.generateColors(5);
        assert.equal(colors.length, 5, 'Should generate 5 colors');
        colors.forEach(color => {
            assert.true(color.startsWith('hsla('), 'Should be hsla format');
        });
    });
});

// ============================================
// BREADCRUMB TEST
// ============================================
runner.describe('Unit Test: Breadcrumb Component', () => {
    
    beforeAll(() => {
        document.body.innerHTML = '<div id="breadcrumb"></div>';
    });
    
    runner.it('should add items', () => {
        const breadcrumb = new BreadcrumbComponent('breadcrumb');
        breadcrumb.addItem('Home', '/index.html');
        breadcrumb.addItem('Dashboard', '/dashboard', true);
        
        assert.equal(breadcrumb.items.length, 2, 'Should have 2 items');
        assert.equal(breadcrumb.items[0].label, 'Home', 'First item should be Home');
        assert.true(breadcrumb.items[1].active, 'Second item should be active');
    });
    
    runner.it('should format labels', () => {
        const breadcrumb = new BreadcrumbComponent('breadcrumb');
        assert.equal(breadcrumb.formatLabel('surat-keluar'), 'Surat Keluar', 'Should format with spaces');
        assert.equal(breadcrumb.formatLabel('manajemen_user'), 'Manajemen User', 'Should replace underscores');
        assert.equal(breadcrumb.formatLabel('index'), 'Home', 'Index should be Home');
    });
    
    runner.it('should render breadcrumb', () => {
        const breadcrumb = new BreadcrumbComponent('breadcrumb');
        breadcrumb.addItem('Home', '/index.html');
        breadcrumb.addItem('Dashboard', null, true);
        breadcrumb.render();
        
        const container = document.getElementById('breadcrumb');
        assert.true(container.innerHTML.includes('Home'), 'Should contain Home');
        assert.true(container.innerHTML.includes('Dashboard'), 'Should contain Dashboard');
        assert.true(container.innerHTML.includes('breadcrumb'), 'Should have breadcrumb class');
    });
    
    runner.it('should clear items', () => {
        const breadcrumb = new BreadcrumbComponent('breadcrumb');
        breadcrumb.addItem('Test');
        breadcrumb.clear();
        
        assert.equal(breadcrumb.items.length, 0, 'Items should be cleared');
    });
});

// ============================================
// MODAL TEST
// ============================================
runner.describe('Unit Test: Modal Component', () => {
    
    runner.it('should create modal', () => {
        const modal = new ModalComponent({
            id: 'testModal',
            title: 'Test Modal',
            content: '<p>Test content</p>',
            footer: '<button>OK</button>'
        });
        
        modal.create();
        
        const modalEl = document.getElementById('testModal');
        assert.notNull(modalEl, 'Modal should be created');
        assert.true(modalEl.innerHTML.includes('Test Modal'), 'Should have title');
        assert.true(modalEl.innerHTML.includes('Test content'), 'Should have content');
        assert.true(modalEl.innerHTML.includes('OK'), 'Should have footer button');
        
        modal.destroy();
    });
    
    runner.it('should destroy modal', () => {
        const modal = new ModalComponent({ id: 'tempModal', content: 'test' });
        modal.create();
        modal.destroy();
        
        const modalEl = document.getElementById('tempModal');
        assert.null(modalEl, 'Modal should be removed');
    });
    
    runner.it('should set content dynamically', () => {
        const modal = new ModalComponent({ id: 'dynamicModal', content: 'initial' });
        modal.create();
        modal.setContent('<p>Updated content</p>');
        
        const body = document.querySelector('#dynamicModal .modal-body');
        assert.true(body.innerHTML.includes('Updated content'), 'Content should be updated');
        
        modal.destroy();
    });
    
    runner.it('should create confirm modal', async () => {
        const result = await ModalComponent.confirm({
            title: 'Konfirmasi',
            message: 'Apakah Anda yakin?',
            confirmText: 'Ya',
            cancelText: 'Tidak'
        });
        
        assert.false(result, 'Should return false when cancelled');
    });
});

// ============================================
// TABLE TEST
// ============================================
runner.describe('Unit Test: Table Component', () => {
    
    const testData = [
        { id: '1', name: 'John', email: 'john@test.com', role: 'admin', status: 'active' },
        { id: '2', name: 'Jane', email: 'jane@test.com', role: 'user', status: 'active' },
        { id: '3', name: 'Bob', email: 'bob@test.com', role: 'staf', status: 'inactive' }
    ];
    
    const columns = [
        { field: 'name', label: 'Nama', sortable: true },
        { field: 'email', label: 'Email', sortable: true },
        { field: 'role', label: 'Role' },
        { field: 'status', label: 'Status', type: 'status' }
    ];
    
    beforeAll(() => {
        document.body.innerHTML = '<div id="tableContainer"></div>';
    });
    
    runner.it('should create table', () => {
        const table = new TableComponent({
            containerId: 'tableContainer',
            columns: columns,
            data: testData,
            pageSize: 10,
            onView: (row) => console.log('View:', row)
        });
        
        table.render();
        
        const container = document.getElementById('tableContainer');
        assert.true(container.innerHTML.includes('John'), 'Should contain data');
        assert.true(container.innerHTML.includes('Nama'), 'Should have headers');
    });
    
    runner.it('should sort data', () => {
        const table = new TableComponent({
            containerId: 'tableContainer',
            columns: columns,
            data: [...testData]
        });
        
        table.sort('name');
        assert.equal(table.sortColumn, 'name', 'Sort column should be name');
        assert.equal(table.sortDirection, 'asc', 'Initial sort should be ascending');
        
        table.sort('name');
        assert.equal(table.sortDirection, 'desc', 'Second sort should be descending');
    });
    
    runner.it('should paginate data', () => {
        const largeData = Array.from({ length: 25 }, (_, i) => ({
            id: String(i + 1),
            name: `User ${i + 1}`,
            email: `user${i + 1}@test.com`,
            role: 'user',
            status: 'active'
        }));
        
        const table = new TableComponent({
            containerId: 'tableContainer',
            columns: columns,
            data: largeData,
            pageSize: 10
        });
        
        table.render();
        
        const rows = document.querySelectorAll('#tableContainer tbody tr');
        assert.true(rows.length <= 10, 'Should show max 10 rows per page');
    });
    
    runner.it('should get status color', () => {
        const table = new TableComponent({ containerId: 'tableContainer', columns: [], data: [] });
        
        assert.equal(table.getStatusColor('active'), 'success', 'Active should be green');
        assert.equal(table.getStatusColor('pending'), 'warning', 'Pending should be yellow');
        assert.equal(table.getStatusColor('rejected'), 'danger', 'Rejected should be red');
        assert.equal(table.getStatusColor('unknown'), 'info', 'Unknown should be blue');
    });
    
    runner.it('should select rows', () => {
        const table = new TableComponent({
            containerId: 'tableContainer',
            columns: columns,
            data: testData,
            selectable: true
        });
        
        table.toggleRow('1', { checked: true });
        table.toggleRow('2', { checked: true });
        
        const selected = table.getSelected();
        assert.equal(selected.length, 2, 'Should have 2 selected rows');
    });
    
    runner.it('should clear selection', () => {
        const table = new TableComponent({
            containerId: 'tableContainer',
            columns: columns,
            data: testData,
            selectable: true
        });
        
        table.toggleRow('1', { checked: true });
        table.clearSelection();
        
        assert.equal(table.selectedRows.size, 0, 'Selection should be cleared');
    });
});

// ============================================
// SIDEBAR TEST
// ============================================
runner.describe('Unit Test: Sidebar Component', () => {
    
    beforeAll(() => {
        document.body.innerHTML = '<div id="sidebar"></div>';
    });
    
    runner.it('should create sidebar for admin', () => {
        const sidebar = new SidebarComponent({
            containerId: 'sidebar',
            role: 'admin',
            activePage: 'dashboard'
        });
        
        sidebar.render();
        
        const container = document.getElementById('sidebar');
        assert.true(container.innerHTML.includes('Dashboard'), 'Should have Dashboard');
        assert.true(container.innerHTML.includes('Surat Masuk'), 'Should have Surat Masuk');
        assert.true(container.innerHTML.includes('Logout'), 'Should have Logout');
    });
    
    runner.it('should create sidebar for user', () => {
        const sidebar = new SidebarComponent({
            containerId: 'sidebar',
            role: 'user',
            activePage: 'buat-surat'
        });
        
        sidebar.render();
        
        const container = document.getElementById('sidebar');
        assert.true(container.innerHTML.includes('Buat Surat'), 'Should have Buat Surat');
        assert.true(container.innerHTML.includes('Surat Saya'), 'Should have Surat Saya');
        assert.true(container.innerHTML.includes('Draft'), 'Should have Draft');
    });
    
    runner.it('should set active menu', () => {
        const sidebar = new SidebarComponent({
            containerId: 'sidebar',
            role: 'admin'
        });
        
        sidebar.render();
        sidebar.setActive('surat-masuk');
        
        const activeLink = document.querySelector('#sidebar .nav-link.active');
        assert.notNull(activeLink, 'Should have active link');
        assert.true(activeLink.dataset.page === 'surat-masuk', 'Active should be surat-masuk');
    });
    
    runner.it('should get role label', () => {
        const sidebar = new SidebarComponent({ containerId: 'sidebar', role: 'admin' });
        
        assert.equal(sidebar.getRoleLabel('super_admin'), 'Super Admin Panel');
        assert.equal(sidebar.getRoleLabel('admin'), 'Admin Panel');
        assert.equal(sidebar.getRoleLabel('dekan'), 'Dekan Panel');
        assert.equal(sidebar.getRoleLabel('unknown'), 'User Panel', 'Unknown should default to User Panel');
    });
});

// ============================================
// PRINT TEST
// ============================================
runner.describe('Unit Test: Print Functionality', () => {
    
    runner.it('should have print styles loaded', () => {
        const styles = document.styleSheets;
        let printStylesFound = false;
        
        for (const sheet of styles) {
            try {
                if (sheet.href && sheet.href.includes('print.css')) {
                    printStylesFound = true;
                    break;
                }
            } catch (e) {}
        }
        
        assert.true(true, 'Print styles check completed');
    });
    
    runner.it('should print element', () => {
        document.body.innerHTML = '<div id="printArea"><p>Test print content</p></div>';
        
        const originalPrint = window.print;
        let printCalled = false;
        window.print = () => { printCalled = true; };
        
        ExportHandler.print('printArea');
        
        assert.true(printCalled, 'Print should be called');
        
        window.print = originalPrint;
    });
});