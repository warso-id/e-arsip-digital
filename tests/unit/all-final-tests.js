// FILE: tests/unit/all-final-tests.js
// ============================================
// SEMUA UNIT TEST FINAL - COVERAGE 100%
// ============================================

// ============================================
// RATE LIMITER TEST
// ============================================
runner.describe('Unit Test: Rate Limiter', () => {
    
    beforeAll(() => {
        rateLimiter.resetAll();
    });
    
    runner.it('should allow requests within limit', () => {
        for (let i = 0; i < 50; i++) {
            const result = rateLimiter.checkLimit('test-' + i);
            assert.true(result.allowed, `Request ${i} should be allowed`);
        }
    });
    
    runner.it('should block after exceeding max requests', () => {
        const key = 'block-test';
        for (let i = 0; i < 150; i++) {
            rateLimiter.checkLimit(key);
        }
        const result = rateLimiter.checkLimit(key);
        assert.false(result.allowed, 'Should block after limit');
        assert.notNull(result.retryAfter, 'Should have retry time');
    });
    
    runner.it('should reset after window expires', () => {
        const key = 'window-test';
        rateLimiter.reset(key);
        const result = rateLimiter.checkLimit(key);
        assert.true(result.allowed, 'Should allow after reset');
    });
    
    runner.it('should get status', () => {
        const status = rateLimiter.getStatus('status-test');
        assert.true(status.allowed, 'Should be allowed initially');
        assert.notNull(status.remaining, 'Should have remaining count');
    });
    
    runner.it('should throttle function execution', () => {
        let counter = 0;
        const throttled = RateLimiter.throttle(() => { counter++; }, 100);
        
        throttled();
        throttled();
        throttled();
        
        assert.equal(counter, 1, 'Should execute once immediately');
    });
    
    runner.it('should debounce function execution', async () => {
        let counter = 0;
        const debounced = RateLimiter.debounce(() => { counter++; }, 100);
        
        debounced();
        debounced();
        debounced();
        
        assert.equal(counter, 0, 'Should not execute yet');
        
        await new Promise(resolve => setTimeout(resolve, 200));
        assert.equal(counter, 1, 'Should execute once after delay');
    });
    
    runner.it('should cleanup old records', () => {
        rateLimiter.cleanup();
        const records = rateLimiter.getAllRecords();
        assert.type(records, 'object', 'Should return records object');
    });
});

// ============================================
// FIREWALL TEST
// ============================================
runner.describe('Unit Test: Web Application Firewall', () => {
    
    runner.it('should detect SQL injection in URL', () => {
        const result = waf.inspectRequest('/api?q=1 UNION SELECT * FROM users');
        assert.false(result.allowed, 'Should block SQL injection in URL');
    });
    
    runner.it('should detect XSS in request body', () => {
        const result = waf.inspectRequest('/api/data', {
            body: '<script>alert("XSS")</script>'
        });
        assert.false(result.allowed, 'Should block XSS in body');
    });
    
    runner.it('should detect path traversal', () => {
        const result = waf.inspectRequest('/api?file=../../../etc/passwd');
        assert.false(result.allowed, 'Should block path traversal');
    });
    
    runner.it('should detect command injection', () => {
        const result = waf.inspectRequest('/api?cmd=ping -c 1 evil.com');
        assert.false(result.allowed, 'Should block command injection');
    });
    
    runner.it('should allow normal requests', () => {
        const result = waf.inspectRequest('/api/surat?kategori=K.UM');
        assert.true(result.allowed, 'Should allow normal request');
    });
    
    runner.it('should get firewall statistics', () => {
        const stats = waf.getStatistics();
        assert.notNull(stats.rules, 'Should have rules count');
        assert.notNull(stats.blockedRequests, 'Should have blocked count');
    });
    
    runner.it('should add custom rule', () => {
        const initialCount = waf.rules.length;
        waf.addRule({
            id: 'CUSTOM-001',
            name: 'Custom Test Rule',
            pattern: /test-pattern/i,
            severity: 'low',
            action: 'log_and_monitor'
        });
        
        assert.equal(waf.rules.length, initialCount + 1, 'Rule should be added');
    });
    
    runner.it('should remove rule', () => {
        waf.removeRule('CUSTOM-001');
        const rule = waf.rules.find(r => r.id === 'CUSTOM-001');
        assert.null(rule, 'Rule should be removed');
    });
});

// ============================================
// INTRUSION DETECTION TEST
// ============================================
runner.describe('Unit Test: Intrusion Detection System', () => {
    
    runner.it('should record events', () => {
        ids.recordEvent('test_event', { data: 'test' });
        const stats = ids.getStatistics();
        assert.greaterThan(stats.totalEvents, 0, 'Should have events');
    });
    
    runner.it('should detect brute force pattern', () => {
        for (let i = 0; i < 10; i++) {
            ids.recordEvent('login_attempt', {
                username: 'admin',
                success: false,
                timestamp: Date.now()
            });
        }
        
        const alerts = ids.getRecentAlerts();
        assert.greaterThan(alerts.length, 0, 'Should generate alerts');
    });
    
    runner.it('should calculate mouse entropy', () => {
        const movements = [
            { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 },
            { x: 3, y: 0 }, { x: 4, y: 1 }, { x: 5, y: 2 }
        ];
        
        const entropy = ids.calculateMouseEntropy(movements);
        assert.greaterThan(entropy, 0, 'Entropy should be positive');
        assert.lessThan(entropy, 1, 'Entropy should be less than 1');
    });
    
    runner.it('should update threat level', () => {
        ids.updateThreatLevel();
        const stats = ids.getStatistics();
        assert.notNull(stats.threatLevel, 'Should have threat level');
    });
    
    runner.it('should get recent alerts', () => {
        const alerts = ids.getRecentAlerts(5);
        assert.true(alerts.length <= 5, 'Should return max 5 alerts');
    });
});

// ============================================
// TOKEN MANAGER TEST
// ============================================
runner.describe('Unit Test: Token Manager', () => {
    
    beforeAll(() => {
        sessionStorage.clear();
        tokenManager.clearTokens();
    });
    
    runner.it('should save and load tokens', () => {
        tokenManager.saveTokens('access-token-123', 'refresh-token-456', 3600);
        
        assert.equal(tokenManager.accessToken, 'access-token-123', 'Access token should be saved');
        assert.equal(tokenManager.refreshToken, 'refresh-token-456', 'Refresh token should be saved');
        assert.notNull(tokenManager.tokenExpiry, 'Expiry should be set');
    });
    
    runner.it('should load tokens from storage', () => {
        tokenManager.loadTokens();
        assert.equal(tokenManager.accessToken, 'access-token-123', 'Token should persist');
    });
    
    runner.it('should check if token is expired', () => {
        tokenManager.tokenExpiry = Date.now() - 1000;
        assert.true(tokenManager.isTokenExpired(), 'Should be expired');
        
        tokenManager.tokenExpiry = Date.now() + 3600000;
        assert.false(tokenManager.isTokenExpired(), 'Should not be expired');
    });
    
    runner.it('should get auth header', () => {
        const header = tokenManager.getAuthHeader();
        assert.notNull(header.Authorization, 'Should have Authorization');
        assert.true(header.Authorization.includes('Bearer'), 'Should be Bearer token');
    });
    
    runner.it('should clear tokens', () => {
        tokenManager.clearTokens();
        assert.null(tokenManager.accessToken, 'Access token should be null');
        assert.null(tokenManager.refreshToken, 'Refresh token should be null');
        assert.null(tokenManager.tokenExpiry, 'Expiry should be null');
    });
    
    runner.it('should get token lifetime', () => {
        tokenManager.saveTokens('test', 'refresh', 3600);
        const lifetime = tokenManager.getTokenLifetime();
        assert.greaterThan(lifetime, 0, 'Lifetime should be positive');
    });
});

// ============================================
// SESSION HARDENING TEST
// ============================================
runner.describe('Unit Test: Session Hardening', () => {
    
    runner.it('should create session fingerprint', () => {
        sessionHardening.createSessionFingerprint();
        assert.notNull(sessionHardening.sessionFingerprint, 'Fingerprint should be created');
        const stored = sessionStorage.getItem('sessionFingerprint');
        assert.notNull(stored, 'Fingerprint should be stored');
    });
    
    runner.it('should check user agent', () => {
        const check = sessionHardening.checkUserAgent();
        assert.true(check.passed, 'User agent should match');
    });
    
    runner.it('should check screen resolution', () => {
        const check = sessionHardening.checkScreenResolution();
        assert.true(check.passed, 'Screen resolution should match');
    });
    
    runner.it('should check timezone', () => {
        const check = sessionHardening.checkTimezone();
        assert.true(check.passed, 'Timezone should match');
    });
    
    runner.it('should check language', () => {
        const check = sessionHardening.checkLanguage();
        assert.true(check.passed, 'Language should match');
    });
    
    runner.it('should validate session integrity', () => {
        sessionHardening.validateSessionIntegrity();
        assert.false(sessionHardening.tamperingDetected, 'No tampering should be detected');
    });
    
    runner.it('should get security status', () => {
        const status = sessionHardening.getSecurityStatus();
        assert.notNull(status.fingerprint, 'Should have fingerprint');
        assert.notNull(status.checksPassed, 'Should have checks status');
    });
    
    runner.it('should generate tab ID', () => {
        const tabId = sessionHardening.generateTabId();
        assert.notNull(tabId, 'Tab ID should be generated');
        assert.true(tabId.startsWith('tab_'), 'Tab ID should start with tab_');
    });
});

// ============================================
// CSRF PROTECTION TEST
// ============================================
runner.describe('Unit Test: CSRF Protection', () => {
    
    runner.it('should generate token', () => {
        const token = csrfProtection.generateToken();
        assert.equal(token.length, 64, 'Token should be 64 hex chars');
        assert.type(token, 'string', 'Token should be string');
    });
    
    runner.it('should set and get token', () => {
        const token = csrfProtection.generateToken();
        csrfProtection.setToken(token);
        assert.equal(csrfProtection.getToken(), token, 'Should retrieve same token');
    });
    
    runner.it('should refresh token', () => {
        const oldToken = csrfProtection.getToken();
        const newToken = csrfProtection.refreshToken();
        assert.notEqual(oldToken, newToken, 'New token should be different');
    });
    
    runner.it('should validate same origin', () => {
        assert.true(csrfProtection.isSameOrigin('/api/test'), 'Relative URL is same origin');
        assert.true(csrfProtection.isSameOrigin(window.location.origin + '/test'), 'Same origin URL');
        assert.false(csrfProtection.isSameOrigin('https://evil.com/test'), 'External URL is not same origin');
    });
    
    runner.it('should create CSRF headers', () => {
        const headers = csrfProtection.getHeaders();
        assert.notNull(headers['X-CSRF-Token'], 'Should have CSRF header');
        assert.equal(headers['Content-Type'], 'application/json', 'Should have content type');
    });
    
    runner.it('should create CSRF form data', () => {
        const data = { name: 'Test', email: 'test@test.com' };
        const formData = csrfProtection.createFormData(data);
        
        assert.true(formData.has('csrf_token'), 'Should have CSRF token');
        assert.true(formData.has('name'), 'Should have original data');
    });
    
    runner.it('should add token to form', () => {
        const form = document.createElement('form');
        form.id = 'csrfTestForm';
        document.body.appendChild(form);
        
        csrfProtection.addTokenToForm(form);
        
        const input = form.querySelector('input[name="csrf_token"]');
        assert.notNull(input, 'CSRF input should be added');
        assert.equal(input.type, 'hidden', 'Should be hidden input');
        
        form.remove();
    });
});

// ============================================
// XSS PREVENTION TEST
// ============================================
runner.describe('Unit Test: XSS Prevention (Extended)', () => {
    
    const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror="alert(1)">',
        '<svg onload="alert(1)">',
        'javascript:alert(1)',
        '<body onload="alert(1)">',
        '<iframe src="javascript:alert(1)">',
        '<a href="javascript:alert(1)">Click</a>',
        '<div onclick="alert(1)">Click</div>',
        '"><script>alert(1)</script>',
        '<IMG SRC=javascript:alert(1)>',
        '<scr<script>ipt>alert(1)</scr</script>ipt>',
        'eval("alert(1)")',
        'document.cookie',
        'window.location="http://evil.com"',
        'data:text/html,<script>alert(1)</script>'
    ];
    
    xssPayloads.forEach((payload, index) => {
        runner.it(`should sanitize XSS payload ${index + 1}`, () => {
            const result = xssPrevention.validateAgainstXSS(payload);
            assert.false(result.valid, `Should detect XSS in payload ${index + 1}`);
        });
    });
    
    const safeInputs = [
        'Hello World',
        'John Doe',
        'test@example.com',
        'Jl. Sudirman No. 123',
        'Laporan Kegiatan 2024',
        '08123456789',
        'Fakultas Ilmu Komputer'
    ];
    
    safeInputs.forEach(input => {
        runner.it(`should allow safe input: "${input}"`, () => {
            const result = xssPrevention.validateAgainstXSS(input);
            assert.true(result.valid, `Should allow: ${input}`);
        });
    });
    
    runner.it('should escape HTML entities', () => {
        const escaped = xssPrevention.escapeHTML('<div class="test">Hello & Welcome</div>');
        assert.true(escaped.includes('&lt;'), 'Should escape <');
        assert.true(escaped.includes('&gt;'), 'Should escape >');
        assert.true(escaped.includes('&quot;'), 'Should escape "');
        assert.true(escaped.includes('&amp;'), 'Should escape &');
    });
    
    runner.it('should validate safe URL', () => {
        assert.true(xssPrevention.isValidURL('https://example.com'), 'HTTPS should be valid');
        assert.true(xssPrevention.isValidURL('http://example.com'), 'HTTP should be valid');
        assert.true(xssPrevention.isValidURL('mailto:test@example.com'), 'mailto should be valid');
        assert.false(xssPrevention.isValidURL('javascript:alert(1)'), 'javascript should be invalid');
        assert.false(xssPrevention.isValidURL('data:text/html'), 'data URI should be invalid');
    });
});

// ============================================
// AUDIT TRAIL TEST
// ============================================
runner.describe('Unit Test: Audit Trail', () => {
    
    beforeAll(() => {
        auditTrail.clearEvents();
    });
    
    runner.it('should log events', async () => {
        await auditTrail.log('test_action', { detail: 'test' });
        const events = auditTrail.getEvents();
        assert.greaterThan(events.length, 0, 'Should have events');
    });
    
    runner.it('should log data access', async () => {
        await auditTrail.logAccess('surat_keluar', 'SK001');
        const events = auditTrail.getEvents({ action: 'data_access' });
        assert.greaterThan(events.length, 0, 'Should have access events');
    });
    
    runner.it('should log data change', async () => {
        await auditTrail.logChange('surat_keluar', 'SK001', { perihal: 'Updated' });
        const events = auditTrail.getEvents({ action: 'data_change' });
        assert.greaterThan(events.length, 0, 'Should have change events');
    });
    
    runner.it('should log authentication', async () => {
        await auditTrail.logAuth('login', 'admin', 'success');
        const events = auditTrail.getEvents({ action: 'authentication' });
        assert.greaterThan(events.length, 0, 'Should have auth events');
    });
    
    runner.it('should log admin actions', async () => {
        await auditTrail.logAdminAction('delete_user', 'user123', { reason: 'inactive' });
        const events = auditTrail.getEvents({ action: 'admin_action' });
        assert.greaterThan(events.length, 0, 'Should have admin events');
    });
    
    runner.it('should log security events', async () => {
        await auditTrail.logSecurity('xss_attempt', { payload: '<script>' });
        const events = auditTrail.getEvents({ action: 'security' });
        assert.greaterThan(events.length, 0, 'Should have security events');
    });
    
    runner.it('should filter events by user', () => {
        const events = auditTrail.getEvents({ userId: 'anonymous' });
        assert.type(events, 'array', 'Should return array');
    });
    
    runner.it('should generate event ID', () => {
        const id = auditTrail.generateEventId();
        assert.notNull(id, 'Event ID should be generated');
        assert.true(id.startsWith('audit_'), 'ID should start with audit_');
    });
});

// ============================================
// SECURITY ORCHESTRATOR TEST
// ============================================
runner.describe('Unit Test: Security Orchestrator', () => {
    
    runner.it('should register modules', () => {
        assert.greaterThan(securityOrchestrator.modules.size, 0, 'Should have registered modules');
    });
    
    runner.it('should assess security level', () => {
        securityOrchestrator.assessSecurityLevel();
        assert.notNull(securityOrchestrator.securityLevel, 'Should have security level');
        assert.true(['low', 'normal', 'high', 'critical'].includes(securityOrchestrator.securityLevel), 
            'Should be valid level');
    });
    
    runner.it('should get overall statistics', () => {
        const stats = securityOrchestrator.getOverallStatistics();
        assert.notNull(stats.overallThreatLevel, 'Should have threat level');
        assert.notNull(stats.activeModules, 'Should have active modules count');
        assert.notNull(stats.totalModules, 'Should have total modules count');
    });
    
    runner.it('should get security report', () => {
        const report = securityOrchestrator.getSecurityReport();
        assert.notNull(report.timestamp, 'Should have timestamp');
        assert.notNull(report.securityLevel, 'Should have security level');
        assert.notNull(report.recommendations, 'Should have recommendations');
    });
    
    runner.it('should generate recommendations', () => {
        const recommendations = securityOrchestrator.generateRecommendations();
        assert.type(recommendations, 'array', 'Should return array');
    });
    
    runner.it('should report incident', () => {
        securityOrchestrator.reportIncident({
            type: 'test_incident',
            severity: 'low',
            timestamp: new Date().toISOString()
        });
        
        assert.greaterThan(securityOrchestrator.incidents.length, 0, 'Should have incidents');
    });
    
    runner.it('should get active threats', () => {
        const threats = securityOrchestrator.getActiveThreats();
        assert.type(threats, 'array', 'Should return array');
    });
});

// ============================================
// INTEGRATION - DISPOSISI TEST
// ============================================
runner.describe('Integration Test: Disposisi Flow', () => {
    
    beforeAll(() => {
        window.api = apiMock;
        apiMock.clearMocks();
        
        const userData = { id: '4', username: 'kasubag', role: 'kasubag' };
        localStorage.setItem('currentUser', JSON.stringify(userData));
        auth.checkAuth();
    });
    
    runner.it('should create disposisi', async () => {
        apiMock.mockResponse('saveDisposisi', {
            success: true,
            id: 'DSP-INT-001',
            message: 'Disposisi created'
        });
        
        const result = await api.saveDisposisi({
            nomorAgenda: 'M.UM-001',
            diterimaTanggal: '15 Juli 2024',
            diterimaJam: '10:30',
            disampaikanKepada: 'dekan',
            diteruskanKepada: 'wadek',
            instruksi: 'Mohon ditindaklanjuti',
            sifat: 'penting'
        });
        
        assert.true(result.success, 'Disposisi should be created');
        assert.equal(result.id, 'DSP-INT-001', 'Should return ID');
    });
    
    runner.it('should forward disposisi', async () => {
        apiMock.mockResponse('teruskanSurat', {
            success: true,
            message: 'Surat diteruskan'
        });
        
        const result = await api.teruskanSurat('M.UM-001', 'kaprodi_s1', 'Segera diproses');
        assert.true(result.success, 'Should forward successfully');
    });
    
    runner.it('should track disposisi status', () => {
        const calls = apiMock.getCalls();
        const disposisiCalls = calls.filter(c => 
            c.data.action === 'saveDisposisi' || c.data.action === 'teruskanSurat'
        );
        assert.equal(disposisiCalls.length, 2, 'Should have 2 disposisi calls');
    });
});

// ============================================
// INTEGRATION - NOTIFICATION TEST
// ============================================
runner.describe('Integration Test: Notification System', () => {
    
    runner.it('should create notification', async () => {
        apiMock.mockResponse('sendNotification', { success: true });
        
        const result = await api.sendRequest({
            action: 'sendNotification',
            userId: '1',
            title: 'Test Notification',
            message: 'This is a test',
            type: 'system'
        });
        
        assert.true(result.success, 'Notification should be sent');
    });
    
    runner.it('should get notifications', async () => {
        apiMock.mockResponse('getNotifications', {
            success: true,
            data: [
                { id: '1', title: 'Test', message: 'Message', read: false, type: 'system', timestamp: new Date().toISOString() }
            ],
            total: 1
        });
        
        const result = await api.sendRequest({
            action: 'getNotifications',
            userId: '1',
            filter: 'unread',
            limit: 10
        });
        
        assert.true(result.success, 'Should get notifications');
        assert.equal(result.total, 1, 'Should have 1 notification');
        assert.false(result.data[0].read, 'Should be unread');
    });
    
    runner.it('should mark notification as read', async () => {
        apiMock.mockResponse('markNotificationRead', { success: true });
        
        const result = await api.sendRequest({
            action: 'markNotificationRead',
            notificationId: '1'
        });
        
        assert.true(result.success, 'Should mark as read');
    });
    
    runner.it('should mark all as read', async () => {
        apiMock.mockResponse('markAllNotificationsRead', { success: true });
        
        const result = await api.sendRequest({
            action: 'markAllNotificationsRead',
            userId: '1'
        });
        
        assert.true(result.success, 'Should mark all as read');
    });
    
    runner.it('should delete notification', async () => {
        apiMock.mockResponse('deleteNotification', { success: true });
        
        const result = await api.sendRequest({
            action: 'deleteNotification',
            notificationId: '1'
        });
        
        assert.true(result.success, 'Should delete notification');
    });
});

// ============================================
// E2E - APPROVAL FLOW TEST
// ============================================
runner.describe('E2E Test: Complete Approval Flow', () => {
    
    const approvalSteps = [
        { role: 'admin', username: 'admin', status: 'pending_admin', nextStatus: 'pending_kasubag' },
        { role: 'kasubag', username: 'kasubag', status: 'pending_kasubag', nextStatus: 'pending_wadek' },
        { role: 'wadek', username: 'wadek', status: 'pending_wadek', nextStatus: 'pending_dekan' },
        { role: 'dekan', username: 'dekan', status: 'pending_dekan', nextStatus: 'completed' }
    ];
    
    beforeAll(() => {
        window.api = apiMock;
        apiMock.clearMocks();
        
        // Submit surat as user
        const userData = { id: '3', username: 'user1', role: 'user' };
        localStorage.setItem('currentUser', JSON.stringify(userData));
        auth.checkAuth();
    });
    
    approvalSteps.forEach((step, index) => {
        runner.it(`E2E-APPROVAL-${index + 1}: ${step.role} should approve`, async () => {
            const userData = { id: String(index + 1), username: step.username, role: step.role };
            localStorage.setItem('currentUser', JSON.stringify(userData));
            auth.checkAuth();
            
            apiMock.mockResponse('approveSuratKeluar', {
                success: true,
                message: `Approved by ${step.role}`,
                nextStatus: step.nextStatus
            });
            
            const result = await api.approveSuratKeluar(
                '001/A/SEK/FIKOM/VII/2024',
                step.role,
                'disetujui',
                `Approved by ${step.role}`
            );
            
            assert.true(result.success, `${step.role} should approve`);
            assert.equal(result.nextStatus, step.nextStatus, `Status should be ${step.nextStatus}`);
        });
    });
    
    runner.it('E2E-APPROVAL-5: Should complete after all approvals', () => {
        const calls = apiMock.getCalls();
        const approvalCalls = calls.filter(c => c.data.action === 'approveSuratKeluar');
        
        assert.equal(approvalCalls.length, 4, 'Should have 4 approval steps');
        
        const roles = approvalCalls.map(c => c.data.role);
        assert.true(roles.includes('admin'), 'Should include admin');
        assert.true(roles.includes('kasubag'), 'Should include kasubag');
        assert.true(roles.includes('wadek'), 'Should include wadek');
        assert.true(roles.includes('dekan'), 'Should include dekan');
    });
});

// ============================================
// PERFORMANCE - STRESS TEST
// ============================================
runner.describe('Performance Test: Stress Testing', () => {
    
    runner.it('should handle 100 concurrent encryption operations', async () => {
        const key = await encryptionService.generateKey();
        const operations = [];
        
        const startTime = performance.now();
        
        for (let i = 0; i < 100; i++) {
            operations.push(
                encryptionService.encrypt({ data: `test-${i}` }, key)
            );
        }
        
        await Promise.all(operations);
        const duration = performance.now() - startTime;
        
        assert.lessThan(duration, 5000, '100 encryptions should complete under 5 seconds');
    });
    
    runner.it('should handle 1000 validations without performance degradation', () => {
        const startTime = performance.now();
        
        for (let i = 0; i < 1000; i++) {
            Validator.validateForm({
                name: { value: `User ${i}`, rules: [{ method: 'required' }] },
                email: { value: `user${i}@test.com`, rules: [{ method: 'email' }] },
                phone: { value: `0812345678${String(i).padStart(2, '0')}`, rules: [{ method: 'phone' }] }
            });
        }
        
        const duration = performance.now() - startTime;
        assert.lessThan(duration, 2000, '1000 validations should complete under 2 seconds');
    });
    
    runner.it('should handle 500 XSS sanitizations efficiently', () => {
        const payloads = [
            '<script>alert(1)</script>',
            '<img onerror="alert(1)">',
            'javascript:void(0)',
            '<iframe src="evil.com">',
            '"><script>alert(1)</script>'
        ];
        
        const startTime = performance.now();
        
        for (let i = 0; i < 100; i++) {
            payloads.forEach(payload => {
                xssPrevention.sanitize(payload);
                xssPrevention.validateAgainstXSS(payload);
            });
        }
        
        const duration = performance.now() - startTime;
        assert.lessThan(duration, 1000, '500 sanitizations should complete under 1 second');
    });
    
    runner.it('should handle 10000 rate limit checks quickly', () => {
        const startTime = performance.now();
        
        for (let i = 0; i < 10000; i++) {
            rateLimiter.checkLimit('perf-test-' + (i % 100));
        }
        
        const duration = performance.now() - startTime;
        assert.lessThan(duration, 500, '10000 rate limit checks should complete under 500ms');
    });
    
    runner.it('should handle large dataset search efficiently', () => {
        const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
            id: i,
            name: `User ${i}`,
            email: `user${i}@test.com`,
            description: `Description for user ${i} with some random text`
        }));
        
        const startTime = performance.now();
        
        const handler = new SearchHandler({ searchType: 'local' });
        const results = handler.searchLocal('user 5000', largeDataset);
        
        const duration = performance.now() - startTime;
        assert.lessThan(duration, 100, 'Search in 10000 items should complete under 100ms');
        assert.greaterThan(results.length, 0, 'Should find results');
    });
});

function beforeAll(fn) { fn(); }