import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email e senha são obrigatórios');
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { company: true, seller: true },
        });

        if (!user) {
          throw new Error('Credenciais inválidas');
        }

        if (!user.isActive) {
          throw new Error('Conta desativada. Contate o administrador.');
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          throw new Error('Credenciais inválidas');
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isMaster: user.isMaster,
          companyId: user.companyId ?? '',
          companyName: user.company?.name ?? '',
          sellerId: user.seller?.id ?? '',
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.isMaster = user.isMaster;
        token.companyId = user.companyId;
        token.companyName = user.companyName;
        token.sellerId = user.sellerId;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session?.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.isMaster = token.isMaster as boolean;
        session.user.companyId = token.companyId as string;
        session.user.companyName = token.companyName as string;
        session.user.sellerId = token.sellerId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
