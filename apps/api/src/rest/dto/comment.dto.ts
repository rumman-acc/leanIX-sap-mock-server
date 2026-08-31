import { ApiProperty } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiProperty({ example: 'Owner confirmed this app is still in active use.' })
  message!: string;
}

export class CommentAuthorDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;
}

export class CommentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  factSheetId!: string;

  @ApiProperty()
  message!: string;

  @ApiProperty({ type: CommentAuthorDto })
  author!: CommentAuthorDto;

  @ApiProperty()
  createdAt!: string;
}

export class CommentResponseDto {
  @ApiProperty({ example: 'OK' })
  status!: string;

  @ApiProperty({ type: CommentDto })
  data!: CommentDto;
}

export class CommentListResponseDto {
  @ApiProperty({ example: 'OK' })
  status!: string;

  @ApiProperty({ type: [CommentDto] })
  data!: CommentDto[];
}
