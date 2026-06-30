import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import * as controller from './organizations.controller';
import * as teamController from './teams.controller';
import {
  acceptInviteSchema,
  addTeamMemberSchema,
  changeMemberRoleSchema,
  createOrganizationSchema,
  createTeamSchema,
  inviteMemberSchema,
  transferOwnershipSchema,
  updateOrganizationSchema,
} from './organizations.schema';

/** Organizations + teams, mounted at /api/v1/organizations. All require auth. */
export const organizationsRouter = Router();

organizationsRouter.use(requireAuth);

// Specific routes before parameterized ones.
organizationsRouter.post(
  '/invites/accept',
  validateBody(acceptInviteSchema),
  asyncHandler(controller.acceptInvite),
);

organizationsRouter.post('/', validateBody(createOrganizationSchema), asyncHandler(controller.create));
organizationsRouter.get('/', asyncHandler(controller.listMine));

organizationsRouter.patch('/:id', validateBody(updateOrganizationSchema), asyncHandler(controller.update));
organizationsRouter.delete('/:id', asyncHandler(controller.remove));
organizationsRouter.post('/:id/leave', asyncHandler(controller.leave));
organizationsRouter.post(
  '/:id/transfer-ownership',
  validateBody(transferOwnershipSchema),
  asyncHandler(controller.transferOwnership),
);

// Members
organizationsRouter.get('/:id/members', asyncHandler(controller.listMembers));
organizationsRouter.post('/:id/invites', validateBody(inviteMemberSchema), asyncHandler(controller.invite));
organizationsRouter.patch(
  '/:id/members/:userId',
  validateBody(changeMemberRoleSchema),
  asyncHandler(controller.changeMemberRole),
);
organizationsRouter.delete('/:id/members/:userId', asyncHandler(controller.removeMember));

// Teams
organizationsRouter.get('/:id/teams', asyncHandler(teamController.list));
organizationsRouter.post('/:id/teams', validateBody(createTeamSchema), asyncHandler(teamController.create));
organizationsRouter.delete('/:id/teams/:teamId', asyncHandler(teamController.remove));
organizationsRouter.get('/:id/teams/:teamId/members', asyncHandler(teamController.listMembers));
organizationsRouter.post(
  '/:id/teams/:teamId/members',
  validateBody(addTeamMemberSchema),
  asyncHandler(teamController.addMember),
);
organizationsRouter.delete('/:id/teams/:teamId/members/:userId', asyncHandler(teamController.removeMember));
