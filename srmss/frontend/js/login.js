const API = 'http://localhost:5001/api';

// If already logged in redirect to dashboard
const existingToken = localStorage.getItem('token');
if (existingToken) window.location.href = 'dashboard.html';

// Handle form submit
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const loginBtn = document.getElementById('loginBtn');

    if (!email || !password) {
        showAlert('Please enter your email and password.', 'error');
        return;
    }

    // Show loading state
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
    loginBtn.disabled = true;

    try {
        const res = await fetch(`${API}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (res.ok && data.token) {
            // Save token and user info
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            showAlert('Login successful. Redirecting...', 'success');

            // Redirect based on role
            setTimeout(() => {
                redirectByRole(data.user.role);
            }, 800);

        } else {
            showAlert(data.message || 'Invalid email or password.', 'error');
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
            loginBtn.disabled = false;
        }

    } catch (err) {
        showAlert('Server error. Make sure the backend is running.', 'error');
        loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
        loginBtn.disabled = false;
    }
});

// Redirect based on role
function redirectByRole(role) {
    switch (role) {
        case 'superadmin':
            window.location.href = 'dashboard.html';
            break;
        case 'admin':
            window.location.href = 'dashboard.html';
            break;
        case 'supervisor':
            window.location.href = 'dashboard.html';
            break;
        case 'operator':
            window.location.href = 'schedules.html';
            break;
        default:
            window.location.href = 'dashboard.html';
    }
}

// Toggle password visibility
function togglePassword() {
    const passwordInput = document.getElementById('password');
    const toggleIcon = document.getElementById('toggleIcon');

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleIcon.classList.remove('fa-eye');
        toggleIcon.classList.add('fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        toggleIcon.classList.remove('fa-eye-slash');
        toggleIcon.classList.add('fa-eye');
    }
}

// Show alert message
function showAlert(message, type) {
    const alertDiv = document.getElementById('loginAlert');
    alertDiv.innerHTML = `
        <div class="alert alert-${type}">
            <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'check-circle'}"></i>
            ${message}
        </div>
    `;
}

// Allow pressing Enter to submit
document.getElementById('password').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('loginForm').dispatchEvent(new Event('submit'));
    }
});