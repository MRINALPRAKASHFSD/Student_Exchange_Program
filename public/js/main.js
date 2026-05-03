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
        element.textContent = text;
        element.className = `message ${isSuccess ? 'success' : 'error'}`;
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
                showMessage(registerMessage, `Success! Your Student ID is: ${data.id} (Please save this to login)`, true);
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

    // Check Auth Status & Toggle UI
    const checkAuthStatus = () => {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user'));

        if (token && user) {
            // User is logged in
            heroSection.classList.add('hidden');
            featuresSection.classList.add('hidden');
            dashboardSection.classList.remove('hidden');
            document.getElementById('dashboard-welcome').textContent = `Welcome to SOET Exchange, ${user.name}`;
            
            // Update navbar
            loginBtn.classList.add('hidden');
            registerBtn.classList.add('hidden');
        } else {
            // User is logged out
            heroSection.classList.remove('hidden');
            featuresSection.classList.remove('hidden');
            dashboardSection.classList.add('hidden');
            
            // Update navbar
            loginBtn.classList.remove('hidden');
            registerBtn.classList.remove('hidden');
        }
    };

    // Initial check
    checkAuthStatus();
});
