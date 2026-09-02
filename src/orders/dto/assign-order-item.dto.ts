import { IsUUID } from 'class-validator';

export class AssignOrderItemDto {
  @IsUUID()
  userId: string;
}
