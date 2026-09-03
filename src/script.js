document.addEventListener('DOMContentLoaded', () => {
  const businessInput = document.getElementById('business');
  const emailInput = document.getElementById('email');
  const passInput = document.getElementById('pass');
  const confirmPassInput = document.getElementById('confirmPass');
  const toggleBtn = document.querySelector('.toggle');
  const toggleConfirmBtn = document.querySelector('.toggle-confirm');
  const errorMsg = document.querySelector('.error-msg');
  const signupBtn = document.querySelector('.signup');
  const signinBtn = document.querySelector('.signin');

  const supabase = window.supabase.createClient('https://jekevrqvmqttzcjmmlma.supabase.co', 'sb_publishable_WjpVAaYL62uw2qEtT7zA2Q_w8hxL-DA');


  // only wire up elements that actually exist on the current page
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const isHidden = passInput.type === 'password';
      passInput.type = isHidden ? 'text' : 'password';
      toggleBtn.textContent = isHidden ? 'Hide' : 'Show';
    });
  }

  if (toggleConfirmBtn) {
    toggleConfirmBtn.addEventListener('click', () => {
      const isHidden = confirmPassInput.type === 'password';
      confirmPassInput.type = isHidden ? 'text' : 'password';
      toggleConfirmBtn.textContent = isHidden ? 'Hide' : 'Show';
    });
  }


  [businessInput, emailInput, passInput, confirmPassInput].forEach(input => {
    if (input) input.addEventListener('input', clearError);
  });


  if (signupBtn) {
    signupBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!validateSignupForm()) return;

      const { data, error } = await supabase.auth.signUp({
        email: emailInput.value.trim(),
        password: passInput.value
      });

      if (error) {
        showError(error.message);
        return;
      }

      showSuccess('Account created! Redirecting to sign in...');
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 3000);
    });
  }


  if (signinBtn) {
    signinBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!validateLoginForm()) return;

      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailInput.value.trim(),
        password: passInput.value
      });

      if (error) {
        showError('Incorrect email or passcode.');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      window.location.href = profile.role === 'admin'
        ? 'owner-dashboard.html'
        : 'user-dashboard.html';
    });
  }


  function validateLoginForm() {
    const emailVal = emailInput.value.trim();
    const passVal = passInput.value;

    if (!emailVal) {
      showError('Please enter your email or username.');
      emailInput.focus();
      return false;
    }

    if (!passVal) {
      showError('Please enter your passcode.');
      passInput.focus();
      return false;
    }

    clearError();
    return true;
  }


  function validateSignupForm() {
    const businessVal = businessInput.value.trim();
    const emailVal = emailInput.value.trim();
    const passVal = passInput.value;
    const confirmPassVal = confirmPassInput.value;

    if (!businessVal) {
      showError('Please enter your business name.');
      businessInput.focus();
      return false;
    }

    if (!emailVal) {
      showError('Please enter your email.');
      emailInput.focus();
      return false;
    }

    if (!isValidEmail(emailVal)) {
      showError('Please enter a valid email address.');
      emailInput.focus();
      return false;
    }

    if (!passVal) {
      showError('Please create a passcode.');
      passInput.focus();
      return false;
    }

    if (passVal.length < 8) {
      showError('Passcode must be at least 8 characters.');
      passInput.focus();
      return false;
    }

    if (!confirmPassVal) {
      showError('Please confirm your passcode.');
      confirmPassInput.focus();
      return false;
    }

    if (passVal !== confirmPassVal) {
      showError('Passcodes do not match.');
      confirmPassInput.focus();
      return false;
    }

    clearError();
    return true;
  }


  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }


  function showError(message) {
    errorMsg.style.color = '#e53935';
    errorMsg.textContent = message;
  }

  function showSuccess(message) {
    errorMsg.style.color = '#2e7d32';
    errorMsg.textContent = message;
  }

  function clearError() {
    errorMsg.style.color = '';
    errorMsg.textContent = '';
  }


});