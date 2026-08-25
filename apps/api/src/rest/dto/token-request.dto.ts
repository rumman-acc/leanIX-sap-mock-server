import { ApiProperty } from '@nestjs/swagger';

export class TokenRequestDto {
  @ApiProperty({ enum: ['client_credentials'], example: 'client_credentials' })
  grant_type!: string;

  @ApiProperty({ example: 'dev-token-12345', description: 'Must start with "dev-token-" in mock mode' })
  client_id!: string;

  @ApiProperty({ example: 'dev-secret-67890', description: 'Must start with "dev-secret-" in mock mode' })
  client_secret!: string;
}

export class TokenResponseDto {
  @ApiProperty()
  access_token!: string;

  @ApiProperty({ example: 'bearer' })
  token_type!: string;

  @ApiProperty({ example: 3600 })
  expires_in!: number;

  @ApiProperty({ example: '' })
  scope!: string;
}
