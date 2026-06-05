import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsUUID,
  IsBoolean,
  IsIn,
} from 'class-validator';

export class CreateTaskDto {
  @IsString() @IsNotEmpty() title: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() taskType?: string;

  @IsDateString() dueAt: string; // must be in the future (B8)
  @IsOptional() @IsDateString() reminderAt?: string;

  // Defaults to the creator. Managers may assign to another team member.
  @IsOptional() @IsUUID() assigneeUserId?: string;

  @IsOptional() @IsBoolean() isRecurring?: boolean;
  @IsOptional() @IsString() recurrence?: string;
}

export class UpdateTaskDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() taskType?: string;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsDateString() reminderAt?: string;
  @IsOptional() @IsIn(['pending', 'done', 'cancelled']) status?: string;
}

export class QueryTasksDto {
  // today | overdue | upcoming | all (default all)
  @IsOptional() @IsIn(['today', 'overdue', 'upcoming', 'all']) scope?: string;
  @IsOptional() @IsIn(['pending', 'done', 'overdue', 'cancelled']) status?: string;
}
