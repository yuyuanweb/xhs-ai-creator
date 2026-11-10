import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateArticleDto {
  @IsString()
  @MinLength(50, { message: '正文太短，看起来不是一篇长图文' })
  markdown: string;

  @IsOptional()
  @IsString()
  title?: string;
}
