const PUBLIC_KEY = 'AIzaSyAncVp4HixyOKA3uLWD4fR4MZI37ScTX8g';
const AUTH_URL_START = 'https://identitytoolkit.googleapis.com/v1/';
const DEFAULT_INIT = { 'method': 'POST' };
const ID_KEY = 'userId';

class Authentication {
  async register(params) {
    const response = await requestData(
      AUTH_URL_START,
      'accounts:signUp',
      params
    );
    if (!response.ok) throw Error(response.status.toString());
    await Authentication.#setCookies(response);
  }

  async login(params) {
    const response = await requestData(
      AUTH_URL_START,
      'accounts:signInWithPassword',
      params
    );
    if (!response.ok) throw Error(response.status.toString());
    await Authentication.#setCookies(response);
  }

  logOut() {
    window.localStorage.removeItem(ID_KEY);
  }

  getId() {
    return window.localStorage.getItem(ID_KEY);
  }

  static async #setCookies(response) {
    const data = await response.json();
    window.localStorage.setItem(ID_KEY, data['localId']);
  }
}

export const authentication = new Authentication();

const DATABASE_URL_START = 'https://pixel-toons-default-rtdb.europe-west1.firebasedatabase.app/';

class UserDatabase {
  async getUser(id) {
    const response = await requestData(
      DATABASE_URL_START,
      `users/${id}.json`,
      {},
      {
        'method': 'GET'
      }
    );
    return response.json();
  }

  async createUser(id, values) {
    const paramsObj = {};
    paramsObj[id] = values;
    const response = await requestData(
      DATABASE_URL_START,
      'users.json',
      {},
      {
        'method': 'PATCH',
        'body': JSON.stringify(paramsObj)
      }
    );
    if (!response.ok) {
      throw Error('Something went wrong');
    }
  }

  async setUserUrl(id, url) {
    const paramsObj = {
      'avatarUrl': url
    };
    const response = await requestData(
      DATABASE_URL_START,
      `users/${id}.json`,
      {},
      {
        'method': 'PATCH',
        'body': JSON.stringify(paramsObj)
      }
    );
    if (!response.ok) {
      throw Error('Something went wrong');
    }
  }
}

export const userDatabase = new UserDatabase();

async function requestData(urlStart, route, params, init = DEFAULT_INIT) {
  params['key'] = PUBLIC_KEY;
  const url = urlStart + route + toUrlString(params);
  params['key'] = undefined;
  return fetch(url, init);
}

function toUrlString(params) {
  let string = '?';
  for (const [key, value] of Object.entries(params)) {
    string += `${key}=${value}&`;
  }
  return string;
}

const STORAGE_URL_START = 'https://firebasestorage.googleapis.com/v0/b/pixel-toons.appspot.com/o/';

export async function uploadFile(folder, file) {
  const response = await requestData(
    STORAGE_URL_START,
    folder + '%2F' + crypto.randomUUID(),
    {},
    {
      'method': 'POST',
      'headers': {
        'Content-Type': file.type
      },
      'body': file
    }
  );
  const data = await response.json();
  return `${STORAGE_URL_START}${data['name'].replace('/', '%2F')}?alt=media`;
}
