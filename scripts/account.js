import { authentication, userDatabase } from './utilities/database_handler.js';

const getAccount = async () => {
  const id = authentication.getId();
  if (!id) {
    window.location.href = 'authentication.html';
  } else {
    const userData = await userDatabase.getUser(id);
    for (const [key, value] of Object.entries(userData)) {
      const element = document.getElementById(key);
      if (key !== 'avatarUrl') {
        element.innerText = value;
      } else {
        element.src = value;
      }
    }
  }
};

window.onload = () => {
  getAccount();
  const logOutButton = document.getElementById('log-out');
  logOutButton.onclick = () => {
    authentication.logOut();
    window.location.href = 'authentication.html';
  };
};
