import { IsNotEmpty, IsUUID } from 'class-validator';
import { GetBranchesDto } from './get-branches.dto';

// Admin-side variant of GetBranchesDto — adds the target organisationId,
// which the nested per-org controller gets from the URL path instead.
// See branches-admin.controller.ts's GET / route.
export class GetBranchesForOrgDto extends GetBranchesDto {
  @IsNotEmpty()
  @IsUUID()
  organisationId: string;
}
