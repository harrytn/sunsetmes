'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};
const currentWebsite = () => window.location.hostname;
const serverWebsite = () => '';

export default function WebsiteAddress() {
  const website = useSyncExternalStore(subscribe, currentWebsite, serverWebsite);
  return website ? <p className="small-copy" style={{ marginTop: 20, overflowWrap: 'anywhere' }}>Website: {website}</p> : null;
}
