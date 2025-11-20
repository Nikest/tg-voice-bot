export const dynamic = 'force-dynamic';

import dbConnect from "@/lib/mongoose";
import User from "@/models/User";

export default async function Home() {
  let users = [];

  try {
    await dbConnect();
    users = await User.find().lean();
  } catch (err) {
    console.error('[HOME] Connection error:', err);
  }

  return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black p-6">
        <div className="w-full max-w-2xl">
          <h1 className="text-center text-2xl font-bold mb-6 text-black dark:text-white">
            Список пользователей
          </h1>

          <table className="w-full border-collapse border border-zinc-300 dark:border-zinc-700">
            <thead>
            <tr className="bg-zinc-200 dark:bg-zinc-800">
              <th className="border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-left">User</th>
              <th className="border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-left">Voice</th>
              <th className="border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-left">Credits</th>
            </tr>
            </thead>

            <tbody>
            {users.length === 0 ? (
                <tr>
                  <td
                      colSpan={3}
                      className="text-center py-4 text-zinc-500 dark:text-zinc-400"
                  >
                    Нет записей в базе
                  </td>
                </tr>
            ) : (
                users.map((u) => (
                    <tr key={u._id} className="hover:bg-zinc-100 dark:hover:bg-zinc-800">
                      <td className="border border-zinc-300 dark:border-zinc-700 px-3 py-2">
                        {u.user}
                      </td>
                      <td className="border border-zinc-300 dark:border-zinc-700 px-3 py-2">
                        {u.selectedVoice}
                      </td>
                      <td className="border border-zinc-300 dark:border-zinc-700 px-3 py-2">
                        {u.credits}
                      </td>
                    </tr>
                ))
            )}
            </tbody>
          </table>
        </div>
      </div>
  );
}
