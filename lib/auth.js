import { getServerSession } from "next-auth/next";
import { authOptions } from "../pages/api/auth/[...nextauth]"; // Adjust path if needed

// Helper function to handle server-side authentication
export async function getServerSideProps(context) {
  const session = await getServerSession(context.req, context.res, authOptions);
  
  // For notes page, redirect if not authenticated
  if (context.resolvedUrl.startsWith('/notes') && !session) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }
  
  // Pass the session to the page
  return {
    props: {
      session: session || null,
    },
  };
}
