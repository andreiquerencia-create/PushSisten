import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      isMaster: boolean;
      companyId: string;
      companyName: string;
      sellerId: string;
    };
  }

  interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    isMaster: boolean;
    companyId: string;
    companyName: string;
    sellerId: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    isMaster: boolean;
    companyId: string;
    companyName: string;
    sellerId: string;
  }
}
