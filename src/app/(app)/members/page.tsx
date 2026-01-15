import { createServiceClient } from '@/lib/supabase/server';
import { formatDistanceToNow } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  created_at: string;
  last_login_at: string | null;
}

async function getUsers(): Promise<User[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('last_login_at', { ascending: false });

  if (error) {
    console.error('Error fetching users:', error);
    return [];
  }

  return data || [];
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default async function MembersPage() {
  const users = await getUsers();

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Members</h1>
        <p className="mt-2 text-muted-foreground">
          Team members who have signed into Conductor
        </p>
      </div>

      {users.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
          <p className="text-lg font-medium">No members yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Members will appear here after they sign in
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Last Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.image || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">
                    {user.name || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDistanceToNow(new Date(user.created_at), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell>
                    {user.last_login_at ? (
                      <Badge variant="outline" className="font-normal">
                        {formatDistanceToNow(new Date(user.last_login_at), {
                          addSuffix: true,
                        })}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
