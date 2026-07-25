// tests/fixtures/test-data.js - Test Fixtures 2026
/**
 * E-Arsip Digital - Test Fixtures
 * Version: 2026.1.0
 * Reusable test data for all test suites
 */

const TestData = {
    // ============================================
    // AUTH FIXTURES
    // ============================================
    auth: {
        validUser: {
            username: 'admin',
            password: 'password123',
            email: 'admin@e-arsip.id',
            role: 'admin',
            fullname: 'Administrator'
        },
        invalidUser: {
            username: 'hacker',
            password: 'wrong',
            email: 'invalid@test.com'
        },
        tokens: {
            accessToken: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTAwMSIsInJvbGUiOiJhZG1pbiIsImV4cCI6OTk5OTk5OTk5OX0.mock',
            refreshToken: 'mock-refresh-token-12345',
            expiredToken: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTAwMSIsImV4cCI6MTU3NzgzNjgwMH0.mock'
        },
        session: {
            valid: {
                id: 'sess-001',
                user: { id: 'user-001', username: 'admin', role: 'admin' },
                tokens: { access: 'valid-token', refresh: 'valid-refresh' },
                metadata: { createdAt: Date.now() - 3600000, lastActivity: Date.now() }
            },
            expired: {
                id: 'sess-002',
                user: { id: 'user-001', username: 'admin', role: 'admin' },
                tokens: { access: 'expired-token', refresh: 'expired-refresh' },
                metadata: { createdAt: Date.now() - 86400000, lastActivity: Date.now() - 7200000 }
            }
        }
    },
    
    // ============================================
    // SURAT FIXTURES
    // ============================================
    surat: {
        keluar: {
            valid: {
                perihal: 'Undangan Rapat Koordinasi',
                jenis: 'undangan',
                sifat: 'segera',
                tujuan: 'Seluruh Kaprodi',
                tanggal_surat: '2026-01-15',
                isi_ringkas: 'Mengundang rapat koordinasi semester genap'
            },
            invalid: {
                perihal: '',
                jenis: '',
                tujuan: ''
            },
            updateData: {
                perihal: 'Undangan Rapat Koordinasi (Revisi)',
                sifat: 'sangat_segera'
            }
        },
        masuk: {
            valid: {
                nomor_surat: 'B-123/DIKTI/I/2026',
                perihal: 'Pemberitahuan Hibah',
                pengirim: 'Kemendikbud',
                tgl_surat: '2026-01-10',
                tgl_terima: '2026-01-15'
            }
        },
        disposisi: {
            valid: {
                kepada: 'kaprodi_ti',
                isi_disposisi: 'Mohon ditindaklanjuti',
                batas_waktu: '2026-01-25',
                sifat: 'segera'
            }
        }
    },
    
    // ============================================
    // USER FIXTURES
    // ============================================
    users: {
        admin: {
            id: 'user-001',
            username: 'admin',
            fullname: 'Administrator',
            email: 'admin@e-arsip.id',
            role: 'admin',
            status: 'active',
            permissions: ['manage_users', 'manage_surat', 'approve_surat']
        },
        dekan: {
            id: 'user-002',
            username: 'dekan',
            fullname: 'Dr. Ahmad Fauzi, M.Kom',
            email: 'dekan@e-arsip.id',
            role: 'dekan',
            status: 'active',
            permissions: ['approve_surat', 'view_reports']
        },
        staf: {
            id: 'user-003',
            username: 'staf',
            fullname: 'Budi Santoso',
            email: 'staf@e-arsip.id',
            role: 'staf',
            status: 'active',
            permissions: ['manage_surat']
        },
        newUser: {
            username: 'newuser',
            fullname: 'New User Test',
            email: 'new@e-arsip.id',
            password: 'Password123!',
            role: 'user',
            status: 'active'
        }
    },
    
    // ============================================
    // SETTINGS FIXTURES
    // ============================================
    settings: {
        default: {
            theme: 'light',
            fontSize: 'normal',
            language: 'id',
            notifications: true,
            autoBackup: true,
            version: '2026.1.0'
        },
        penomoran: {
            format: '{nomor}/{kode_unit}/{klasifikasi}/{bulan_romawi}/{tahun}',
            separator: '/',
            resetPeriode: 'tahun',
            nextNumber: 46
        },
        security: {
            encryption: { algorithm: 'AES-256-GCM', keyLength: 256 },
            csrf: { enabled: true, tokenLength: 32 },
            xss: { sanitizeInput: true, sanitizeOutput: true },
            rateLimit: { enabled: true, maxRequests: 100, windowMs: 60000 },
            firewall: { enabled: true, blockSQLInjection: true, blockXSS: true }
        }
    },
    
    // ============================================
    // NOTIFICATION FIXTURES
    // ============================================
    notifications: [
        { id: 'n-001', type: 'info', title: 'Info Notification', message: 'Test info message', read: false },
        { id: 'n-002', type: 'success', title: 'Success Notification', message: 'Test success message', read: false },
        { id: 'n-003', type: 'warning', title: 'Warning Notification', message: 'Test warning message', read: true },
        { id: 'n-004', type: 'error', title: 'Error Notification', message: 'Test error message', read: true }
    ],
    
    // ============================================
    // API RESPONSE FIXTURES
    // ============================================
    apiResponses: {
        success: { success: true, message: 'Operation successful' },
        error: { success: false, error: 'Operation failed', message: 'Test error' },
        notFound: { success: false, error: 'Not Found', message: 'Resource not found', status: 404 },
        unauthorized: { success: false, error: 'Unauthorized', message: 'Authentication required', status: 401 },
        forbidden: { success: false, error: 'Forbidden', message: 'Access denied', status: 403 },
        validation: { success: false, error: 'Validation Error', message: 'Invalid data', errors: { field: 'Field is required' } },
        paginated: {
            data: [],
            total: 0,
            page: 1,
            totalPages: 1,
            hasMore: false
        }
    },
    
    // ============================================
    // FILE FIXTURES
    // ============================================
    files: {
        valid: {
            pdf: { name: 'document.pdf', type: 'application/pdf', size: 102400 },
            image: { name: 'photo.jpg', type: 'image/jpeg', size: 51200 },
            doc: { name: 'letter.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 25600 }
        },
        invalid: {
            tooLarge: { name: 'large.pdf', type: 'application/pdf', size: 52428800 },
            wrongType: { name: 'script.exe', type: 'application/x-msdownload', size: 1024 }
        }
    },
    
    // ============================================
    // THEME FIXTURES
    // ============================================
    themes: {
        light: { name: 'Light', colors: { '--color-bg-primary': '#ffffff', '--color-text-primary': '#1e293b' } },
        dark: { name: 'Dark', colors: { '--color-bg-primary': '#0f172a', '--color-text-primary': '#f1f5f9' } },
        blue: { name: 'Ocean Blue', colors: { '--color-bg-primary': '#f0f9ff', '--color-text-primary': '#1e3a5f' } },
        green: { name: 'Forest Green', colors: { '--color-bg-primary': '#f0fdf4', '--color-text-primary': '#14532d' } },
        purple: { name: 'Royal Purple', colors: { '--color-bg-primary': '#faf5ff', '--color-text-primary': '#3b0764' } },
        orange: { name: 'Sunset Orange', colors: { '--color-bg-primary': '#fff7ed', '--color-text-primary': '#431407' } },
        red: { name: 'Ruby Red', colors: { '--color-bg-primary': '#fef2f2', '--color-text-primary': '#450a0a' } }
    },
    
    // ============================================
    // VALIDATION FIXTURES
    // ============================================
    validation: {
        emails: {
            valid: ['user@example.com', 'test.user@domain.co.id', 'name+tag@test.org'],
            invalid: ['notanemail', '@domain.com', 'user@', 'user @domain.com', '', null]
        },
        phones: {
            valid: ['08123456789', '+628123456789', '6281234567890'],
            invalid: ['12345', 'abc', '0812', '+62abc']
        },
        passwords: {
            valid: ['Password1!', 'SecureP@ss123', 'C0mplex!Pass'],
            invalid: ['short', 'nouppercase1!', 'NOLOWERCASE1!', 'NoNumber!', 'NoSpecial1']
        },
        nip: {
            valid: ['198501012010011001', '199002152015012002'],
            invalid: ['12345', 'abcdefghijklmnopqr', '19850101201001100', '198501322010011001']
        }
    }
};

export default TestData;