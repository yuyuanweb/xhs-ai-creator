import { Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { newId } from '../common/id';

export interface AuthUser {
  id: string;
  username: string;
  role: string;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** 不开放注册，管理员由首次启动时的环境变量创建 */
  async onModuleInit() {
    if ((await this.prisma.user.count()) > 0) return;

    const username = this.config.get<string>('ADMIN_USERNAME');
    const password = this.config.get<string>('ADMIN_PASSWORD');
    if (!username || !password) {
      this.logger.warn('用户表为空且未配置 ADMIN_USERNAME / ADMIN_PASSWORD，无法登录');
      return;
    }

    await this.prisma.user.create({
      data: {
        id: newId('u'),
        username,
        passwordHash: await bcrypt.hash(password, 10),
        role: 'admin',
      },
    });
    this.logger.log(`已创建初始管理员 ${username}`);
  }

  async login(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('用户名或密码不正确');
    }
    const payload: AuthUser = { id: user.id, username: user.username, role: user.role };
    return { token: await this.jwt.signAsync(payload), user: payload };
  }

  async verify(token: string): Promise<AuthUser> {
    try {
      return await this.jwt.verifyAsync<AuthUser>(token);
    } catch {
      throw new UnauthorizedException('登录已过期，请重新登录');
    }
  }
}
