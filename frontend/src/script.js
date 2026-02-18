const loginFormSection = document.getElementById('loginFormSection');
        const signupFormSection = document.getElementById('signupFormSection');
        const fastLoginNav = document.getElementById('fastLoginNav');

        // Toggle to Sign Up
        document.getElementById('goToSignUp').addEventListener('click', () => {
            loginFormSection.classList.add('hidden');
            signupFormSection.classList.remove('hidden');
        });

        // Toggle back to Login
        document.getElementById('goToLogin').addEventListener('click', () => {
            signupFormSection.classList.add('hidden');
            loginFormSection.classList.remove('hidden');
        });

        // Handle Login Form Submission
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            // Show fast login navigation after form submission
            fastLoginNav.classList.remove('hidden');
        });

        // Handle Sign Up Form Submission
        document.getElementById('signupForm').addEventListener('submit', (e) => {
            e.preventDefault();
            // Show fast login navigation after form submission
            fastLoginNav.classList.remove('hidden');
        });

// Toggle Password Visibility (Generic function)
function togglePasswordVisibility(inputId, openIconId, closedIconId) {
    const passwordInput = document.getElementById(inputId);
    const eyeOpenIcon = document.getElementById(openIconId);
    const eyeClosedIcon = document.getElementById(closedIconId);

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        eyeOpenIcon.classList.remove('hidden');
        eyeClosedIcon.classList.add('hidden');
    } else {
        passwordInput.type = 'password';
        eyeOpenIcon.classList.add('hidden');
        eyeClosedIcon.classList.remove('hidden');
    }
}

