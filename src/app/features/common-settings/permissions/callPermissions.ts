import { EventType } from '$types/matrix-sdk';

import type { PermissionGroup } from './types';

// Shown in every room's permission settings, not just call rooms — Element Call
// treats any room as call-capable, so admins configure who can start/join calls
// the same way they configure messaging/moderation permissions elsewhere.
export const CALL_PERMISSIONS_GROUP: PermissionGroup = {
  name: 'Calls',
  items: [
    {
      location: [
        {
          state: true,
          key: EventType.GroupCallPrefix,
        },
        {
          state: true,
          key: EventType.GroupCallMemberPrefix,
        },
      ],
      name: 'Start & Join Calls',
      description: 'Who can start and join voice and video calls.',
    },
  ],
};
