import { useEffect, useState } from 'react';

function getInitial() {
  return localStorage.getItem('sidebarCollapsed') === 'true';
}

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(getInitial);

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(collapsed));
  }, [collapsed]);

  function toggleCollapsed() {
    setCollapsed((c) => !c);
  }

  return { collapsed, toggleCollapsed };
}
