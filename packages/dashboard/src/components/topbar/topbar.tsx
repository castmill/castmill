import { Component, Show, createEffect, createSignal } from 'solid-js';
import './topbar.scss';

import { checkAuth, getUser, resetSession } from '../auth';
import { useNavigate } from '@solidjs/router';
import TopbarLink from '../topbar-link/topbar-link';
import Search from '../search/search';

// Find any icon here: https://solid-icons.vercel.app/search/settings
import { FaRegularBell } from 'solid-icons/fa';
import { TbHelpCircle } from 'solid-icons/tb';

import logo from '../../assets/castmill-logo-topbar.png';
import DropdownMenu from '../dropdown-menu/dropdown-menu';

const baseUrl = 'http://localhost:4000';

const Topbar: Component = () => {
  const [triggerLogout, setTriggerLogout] = createSignal(false);

  const navigate = useNavigate();

  const logout = async () => {
    // Log the user out
    const result = await fetch(`${baseUrl}/sessions`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (result.status === 200) {
      // Reset the user's session
      resetSession();
      navigate('/login');
    }
  };

  createEffect(async () => {
    if (triggerLogout()) {
      await logout();
    }
  });

  return (
    <header class="castmill-header">
      <nav class="main">
        <a href="/">
          <img src={logo} alt="Castmill" />
        </a>
      </nav>

      <nav class="right">
        <Show when={checkAuth()}>
          <Search />

          <TopbarLink to="/help" icon={TbHelpCircle} text="Help"></TopbarLink>

          {/* Implement the Alert icon + Alerts page */}
          <div style="margin: 0 1rem; margin: 0 1rem; display: flex; flex-direction: row; justify-content: center; align-items: center;">
            <FaRegularBell />
          </div>

          <DropdownMenu ButtonComponent={() => <div>{getUser().name} </div>}>
            <a href="/profile">Profile</a>
            <a href="/settings">Settings</a>
            <button class="logout" onClick={() => setTriggerLogout(true)}>
              Logout
            </button>
          </DropdownMenu>
        </Show>
      </nav>
    </header>
  );
};

export default Topbar;
