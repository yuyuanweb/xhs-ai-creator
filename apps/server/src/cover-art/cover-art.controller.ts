import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';
import { CoverArtService, MAX_REFERENCES } from './cover-art.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.service';

class CoverArtDto {
  @IsString()
  @MaxLength(60)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  subject?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_REFERENCES)
  @IsString({ each: true })
  referenceIds?: string[];
}

@Controller('decks')
@UseGuards(JwtAuthGuard)
export class CoverArtController {
  constructor(private readonly coverArt: CoverArtService) {}

  @Post(':id/cover-art')
  generate(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CoverArtDto) {
    return this.coverArt.generate(id, user.id, dto);
  }
}
