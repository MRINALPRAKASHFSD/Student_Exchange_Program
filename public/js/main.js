document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const navbar = document.querySelector('.navbar');
    const authModal = document.getElementById('auth-modal');
    const closeModalBtn = document.getElementById('close-modal');
    
    // Buttons
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const ctaRegisterBtn = document.getElementById('cta-register');
    const logoutBtn = document.getElementById('logout-btn');
    
    // Forms & Containers
    const loginFormContainer = document.getElementById('login-form-container');
    const registerFormContainer = document.getElementById('register-form-container');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    // Switches
    const switchToRegister = document.getElementById('switch-to-register');
    const switchToLogin = document.getElementById('switch-to-login');
    
    // Sections
    const dashboardSection = document.getElementById('dashboard');
    const heroSection = document.querySelector('.hero');
    const featuresSection = document.querySelector('.features');

    // Messages
    const loginMessage = document.getElementById('login-message');
    const registerMessage = document.getElementById('register-message');

    // Navbar Scroll Effect
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Modal Logic
    const openModal = (type) => {
        authModal.classList.add('active');
        if (type === 'login') {
            loginFormContainer.classList.remove('hidden');
            registerFormContainer.classList.add('hidden');
            loginMessage.className = 'message';
        } else {
            registerFormContainer.classList.remove('hidden');
            loginFormContainer.classList.add('hidden');
            registerMessage.className = 'message';
        }
    };

    const closeModal = () => {
        authModal.classList.remove('active');
    };

    loginBtn.addEventListener('click', (e) => { e.preventDefault(); openModal('login'); });
    registerBtn.addEventListener('click', (e) => { e.preventDefault(); openModal('register'); });
    ctaRegisterBtn.addEventListener('click', () => openModal('register'));
    closeModalBtn.addEventListener('click', closeModal);
    
    // Close modal on outside click
    authModal.addEventListener('click', (e) => {
        if (e.target === authModal) closeModal();
    });

    // Switch between Login and Register
    switchToRegister.addEventListener('click', (e) => { e.preventDefault(); openModal('register'); });
    switchToLogin.addEventListener('click', (e) => { e.preventDefault(); openModal('login'); });

    // API Base URL
    const API_URL = '/api';

    // Show Message Helper
    const showMessage = (element, text, isSuccess) => {
        element.innerHTML = text;
        element.className = `message ${isSuccess ? 'success' : 'error'}`;
    };

    window.copyStudentId = (id) => {
        navigator.clipboard.writeText(id).then(() => {
            showToast('Student ID copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            showToast('Failed to copy ID', 'error');
        });
    };

    // Smoother Toast Notification System
    const showToast = (message, type = 'success') => {
        let toast = document.getElementById('toast-notification');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast-notification';
            toast.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: var(--primary);
                color: white;
                padding: 1rem 2rem;
                border-radius: 8px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                z-index: 1000;
                opacity: 0;
                transform: translateY(20px);
                transition: all 0.3s ease;
            `;
            document.body.appendChild(toast);
        }
        
        toast.style.background = type === 'error' ? 'var(--error)' : 'var(--primary)';
        toast.textContent = message;
        
        // Show
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        }, 10);
        
        // Hide
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
        }, 3000);
    };

    // Form Submission: Register
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const password = document.getElementById('reg-password').value;

        // Frontend validation for consecutive non-repeating characters
        if (/(.)\1/.test(password)) {
            showMessage(registerMessage, 'Password must not contain consecutive repeating characters.', false);
            return;
        }

        try {
            const response = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, password })
            });

            const data = await response.json();

            if (response.ok) {
                showMessage(registerMessage, `
                    <div style="display:flex; flex-direction:column; align-items:center; gap:0.5rem;">
                        <span>Success! Your Student ID is: <strong>${data.id}</strong></span>
                        <button type="button" class="btn btn-primary" onclick="copyStudentId('${data.id}')" style="padding: 0.4rem 1rem; font-size: 0.9rem;">
                            <i data-lucide="copy" style="width:14px; height:14px; margin-right:4px;"></i> Copy ID
                        </button>
                        <small>(Please save this to login)</small>
                    </div>
                `, true);
                if (window.lucide) window.lucide.createIcons();
                registerForm.reset();
                // Optionally switch to login after a delay
                // setTimeout(() => openModal('login'), 5000);
            } else {
                showMessage(registerMessage, data.error || 'Registration failed.', false);
            }
        } catch (err) {
            showMessage(registerMessage, 'Server error. Please try again.', false);
        }
    });

    // Form Submission: Login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('login-id').value.trim().replace(/[.,;\s]+$/, '');
        const password = document.getElementById('login-password').value;

        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, password })
            });

            const data = await response.json();

            if (response.ok) {
                // Save token
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                // Show dashboard
                closeModal();
                loginForm.reset();
                checkAuthStatus();
            } else {
                showMessage(loginMessage, data.error || 'Login failed.', false);
            }
        } catch (err) {
            showMessage(loginMessage, 'Server error. Please try again.', false);
        }
    });

    // Logout
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        checkAuthStatus();
    });

    // Fetch Admin Data
    const loadAdminDashboard = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/admin/dashboard`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                document.getElementById('stat-students').textContent = data.users.filter(u => u.role !== 'admin').length;
                document.getElementById('stat-attendance').textContent = data.attendance.length;
                document.getElementById('stat-photos').textContent = data.photos.length;
                document.getElementById('stat-ratings').textContent = data.ratings.length;

                // Render Attendance
                document.getElementById('admin-attendance-body').innerHTML = data.attendance.map(a => `
                    <tr>
                        <td>${a.name}</td>
                        <td>${a.student_id}</td>
                        <td>${a.date}</td>
                        <td>${a.status}</td>
                    </tr>
                `).join('');

                // Render Photos
                document.getElementById('admin-photos-grid').innerHTML = data.photos.map(p => `
                    <div style="background: rgba(0,0,0,0.2); padding: 0.5rem; border-radius: 8px; width: 150px;">
                        <img src="/uploads/${p.filename}" style="width:100%; border-radius:4px; margin-bottom:0.5rem;">
                        <div style="font-size:0.8rem; color:#b0c4de;">${p.name}</div>
                        <div style="font-size:0.8rem;">${p.description || 'No desc'}</div>
                    </div>
                `).join('');

                // Render Ratings
                document.getElementById('admin-ratings-body').innerHTML = data.ratings.map(r => `
                    <tr>
                        <td>${r.name}</td>
                        <td>${r.session_name}</td>
                        <td>${r.rating}/5</td>
                        <td>${r.comments}</td>
                    </tr>
                `).join('');

                // Render Users
                document.getElementById('admin-users-body').innerHTML = data.users.map(u => `
                    <tr>
                        <td>${u.id}</td>
                        <td>${u.name}</td>
                        <td>${u.role}</td>
                        <td>
                            ${u.role === 'student' ? `
                                <label class="btn btn-outline" style="padding: 0.2rem 0.5rem; font-size: 0.8rem; cursor: pointer;">
                                    Upload PDF
                                    <input type="file" accept="application/pdf,image/*" style="display:none;" onchange="uploadCertificate(event, '${u.id}')">
                                </label>
                            ` : '-'}
                        </td>
                    </tr>
                `).join('');

                // Render Activities
                document.getElementById('admin-activities-body').innerHTML = data.activities.map(a => `
                    <tr>
                        <td>${new Date(a.timestamp).toLocaleString()}</td>
                        <td>${a.name} (${a.student_id})</td>
                        <td>${a.activity_type}</td>
                    </tr>
                `).join('');
            }
        } catch (e) {
            console.error('Failed to load admin dashboard', e);
        }
    };

    window.uploadCertificate = async (event, userId) => {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('certificate', file);

        try {
            const res = await fetch(`${API_URL}/admin/certificate/${userId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                showToast('Certificate uploaded successfully!');
            } else {
                showToast(data.error || 'Failed to upload certificate', 'error');
            }
        } catch (e) {
            console.error('Error uploading cert:', e);
            showToast('Error uploading certificate', 'error');
        }
    };

    const loadStudentCertificate = async () => {
        try {
            const res = await fetch(`${API_URL}/user/certificate`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const container = document.getElementById('certificate-status');
            if (res.ok) {
                const data = await res.json();
                container.innerHTML = `
                    <div style="background: rgba(0, 168, 255, 0.1); padding: 1.5rem; border-radius: 8px; border: 1px solid rgba(0, 168, 255, 0.3);">
                        <p style="color:var(--success); font-size: 1.1rem; font-weight: bold; margin-bottom:1rem;">🎉 Your certificate is ready!</p>
                        <a href="/uploads/${data.filename}" download class="btn btn-primary" target="_blank" style="text-decoration:none; display: inline-flex; align-items: center; gap: 0.5rem; font-size: 1.1rem; padding: 0.8rem 1.5rem;">
                            <i data-lucide="download" style="width: 18px; height: 18px;"></i> Download Certificate
                        </a>
                    </div>
                `;
                if (window.lucide) window.lucide.createIcons();
            } else {
                // Timer Logic: 5 days from program start (May 4 -> May 9)
                const unlockDate = new Date('May 9, 2026 17:00:00').getTime();
                
                const updateTimer = () => {
                    const now = new Date().getTime();
                    const distance = unlockDate - now;

                    if (distance < 0) {
                        container.innerHTML = `<p style="color:var(--text-light);">Certificates are being processed. Check back soon!</p>`;
                        return;
                    }

                    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

                    container.innerHTML = `
                        <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px; border: 1px solid var(--glass-border);">
                            <p style="color:var(--text-light); margin-bottom: 0.5rem; font-size: 0.9rem;">Certificates unlock in:</p>
                            <div style="display: flex; justify-content: center; gap: 1rem; font-family: monospace; font-size: 1.5rem; color: var(--primary); font-weight: bold;">
                                <div>${days}d</div>
                                <div>${hours.toString().padStart(2, '0')}h</div>
                                <div>${minutes.toString().padStart(2, '0')}m</div>
                                <div>${seconds.toString().padStart(2, '0')}s</div>
                            </div>
                            <p style="color:var(--text-light); font-size: 0.8rem; margin-top: 0.5rem;">Attend all 5 days to be eligible.</p>
                        </div>
                    `;
                };
                
                updateTimer();
                setInterval(updateTimer, 1000);
            }
        } catch (e) {
            document.getElementById('certificate-status').innerHTML = `<p style="color:var(--error);">Error checking certificate status.</p>`;
        }
    };

    // Check Auth Status & Toggle UI
    const adminDashboard = document.getElementById('admin-dashboard');
    document.getElementById('admin-logout-btn')?.addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        checkAuthStatus();
    });

    const checkAuthStatus = () => {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user'));

        if (token && user) {
            // User is logged in
            heroSection.classList.add('hidden');
            featuresSection.classList.add('hidden');
            
            if (user.role === 'admin') {
                dashboardSection.classList.add('hidden');
                adminDashboard.classList.remove('hidden');
                loadAdminDashboard();
            } else {
                adminDashboard.classList.add('hidden');
                dashboardSection.classList.remove('hidden');
                document.getElementById('dashboard-welcome').textContent = `Welcome to SOET Exchange, ${user.name}`;
                loadStudentCertificate();
            }
            
            // Update navbar
            loginBtn.classList.add('hidden');
            registerBtn.classList.add('hidden');
        } else {
            // User is logged out
            heroSection.classList.remove('hidden');
            featuresSection.classList.remove('hidden');
            dashboardSection.classList.add('hidden');
            adminDashboard.classList.add('hidden');
            
            // Update navbar
            loginBtn.classList.remove('hidden');
            registerBtn.classList.remove('hidden');
        }
    };

    // Form submission handlers for new Student actions
    document.getElementById('attendance-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const date = document.getElementById('att-date').value;
        const status = document.getElementById('att-status').value;
        try {
            await fetch(`${API_URL}/attendance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ date, status })
            });
            showToast('Attendance successfully submitted!');
            e.target.reset();
        } catch(err) { showToast('Failed to submit attendance', 'error'); }
    });

    document.getElementById('photo-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('photo', document.getElementById('photo-file').files[0]);
        formData.append('description', document.getElementById('photo-desc').value);
        try {
            await fetch(`${API_URL}/upload-photo`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: formData
            });
            showToast('Photograph uploaded securely!');
            e.target.reset();
        } catch(err) { showToast('Failed to upload photo', 'error'); }
    });

    document.getElementById('rating-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const session_name = document.getElementById('rate-session').value;
        const rating = document.getElementById('rate-stars').value;
        const comments = document.getElementById('rate-comments').value;
        try {
            await fetch(`${API_URL}/rate-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ session_name, rating, comments })
            });
            showToast('Session rating submitted. Thank you!');
            e.target.reset();
        } catch(err) { showToast('Failed to submit rating', 'error'); }
    });

    // Admin Table Search Filtering
    const setupTableSearch = (inputId, tableId) => {
        document.getElementById(inputId)?.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const rows = document.querySelectorAll(`#${tableId} tbody tr`);
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(term) ? '' : 'none';
            });
        });
    };

    setupTableSearch('search-attendance', 'table-attendance');
    setupTableSearch('search-users', 'table-users');
    setupTableSearch('search-activities', 'table-activities');

    // Scroll Animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-fade-in-up');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.feature-card, .glass-panel, .timeline-item').forEach(el => {
        el.classList.add('opacity-0');
        observer.observe(el);
    });

    // Initial check
    checkAuthStatus();
});
