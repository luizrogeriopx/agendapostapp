import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { checkIsAdmin, listAllUsers, updateUserRole, deleteUserAccount } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ShieldAlert,
  Users,
  Instagram,
  CalendarDays,
  UserCheck,
  UserX,
  Trash2,
  Loader2,
  MoreVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Administração — Agendador de Instagram" }] }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getIsAdmin = useServerFn(checkIsAdmin);
  const getUsers = useServerFn(listAllUsers);
  const changeRole = useServerFn(updateUserRole);
  const removeUser = useServerFn(deleteUserAccount);

  const { data: adminCheck, isLoading: checkingAdmin } = useQuery({
    queryKey: ["admin-check"],
    queryFn: () => getIsAdmin(),
  });

  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => getUsers(),
    enabled: !!adminCheck?.isAdmin,
  });

  const [targetUser, setTargetUser] = useState<any | null>(null);
  const [actionType, setActionType] = useState<"role" | "delete" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Security: redirect if not admin
  useEffect(() => {
    if (!checkingAdmin && adminCheck && !adminCheck.isAdmin) {
      toast.error("Você não tem permissão para acessar esta página.");
      navigate({ to: "/dashboard", replace: true });
    }
  }, [adminCheck, checkingAdmin, navigate]);

  if (checkingAdmin) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!adminCheck?.isAdmin) return null;

  const totalInstagramAccounts = users.reduce((acc, curr) => acc + curr.igCount, 0);
  const totalPosts = users.reduce((acc, curr) => acc + curr.postsStats.total, 0);

  const handleAction = async () => {
    if (!targetUser || !actionType) return;
    setSubmitting(true);
    try {
      if (actionType === "role") {
        const newRole = targetUser.role === "admin" ? "user" : "admin";
        await changeRole({ data: { targetUserId: targetUser.id, role: newRole } });
        toast.success(`Cargo de ${targetUser.displayName} atualizado para ${newRole === "admin" ? "Administrador" : "Usuário Comum"}.`);
      } else if (actionType === "delete") {
        await removeUser({ data: { targetUserId: targetUser.id } });
        toast.success(`Conta de ${targetUser.displayName} foi excluída.`);
      }
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setTargetUser(null);
      setActionType(null);
    } catch (e: any) {
      toast.error(e?.message || "Ocorreu um erro ao realizar a ação.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Administração do Sistema</h1>
        <p className="text-sm text-muted-foreground">Gerencie usuários, acessos e estatísticas globais.</p>
      </div>

      {/* Estatísticas */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
              style={{ background: "var(--gradient-brand)" }}
            >
              <Users className="h-5 w-5" />
            </span>
            <div>
              <p className="text-2xl font-bold text-foreground">{users.length}</p>
              <p className="text-xs text-muted-foreground">Usuários Cadastrados</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
              style={{ background: "var(--gradient-brand)" }}
            >
              <Instagram className="h-5 w-5" />
            </span>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalInstagramAccounts}</p>
              <p className="text-xs text-muted-foreground">Contas Conectadas</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
              style={{ background: "var(--gradient-brand)" }}
            >
              <CalendarDays className="h-5 w-5" />
            </span>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalPosts}</p>
              <p className="text-xs text-muted-foreground">Posts Agendados/Postados</p>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de Usuários */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="border-b px-6 py-4">
          <h2 className="font-semibold text-foreground">Gerenciamento de Contas</h2>
        </div>

        {loadingUsers ? (
          <div className="flex py-10 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                  <th className="px-6 py-3">Usuário</th>
                  <th className="px-6 py-3">Cargo</th>
                  <th className="px-6 py-3 text-center">Contas IG</th>
                  <th className="px-6 py-3 text-center">Agendamentos</th>
                  <th className="px-6 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover border" />
                        ) : (
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted font-bold text-muted-foreground uppercase">
                            {u.displayName.charAt(0)}
                          </span>
                        )}
                        <div>
                          <p className="font-medium text-foreground">{u.displayName}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                        {u.role === "admin" ? "Administrador" : "Usuário"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-center font-medium">{u.igCount}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-xs">
                        <span className="font-semibold text-foreground">{u.postsStats.total}</span> total
                        <span className="text-muted-foreground"> ({u.postsStats.scheduled} ag. / {u.postsStats.published} pub.)</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setTargetUser(u);
                              setActionType("role");
                            }}
                            className="gap-2"
                          >
                            {u.role === "admin" ? (
                              <>
                                <UserX className="h-4 w-4 text-amber-600" />
                                Tornar Usuário Comum
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-4 w-4 text-green-600" />
                                Tornar Administrador
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setTargetUser(u);
                              setActionType("delete");
                            }}
                            className="gap-2 text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                            Excluir Usuário
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmação de Ações */}
      <Dialog open={targetUser !== null} onOpenChange={(open) => !open && setTargetUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Confirmar Ação
            </DialogTitle>
            <DialogDescription className="pt-2">
              {actionType === "role" && targetUser && (
                <>
                  Você tem certeza que deseja alterar o cargo de{" "}
                  <strong>{targetUser.displayName}</strong> para{" "}
                  <strong>{targetUser.role === "admin" ? "Usuário Comum" : "Administrador"}</strong>?
                </>
              )}
              {actionType === "delete" && targetUser && (
                <>
                  Esta ação é <strong>irreversível</strong>. Ela excluirá permanentemente a conta de{" "}
                  <strong>{targetUser.displayName}</strong> ({targetUser.email}), desvinculando todas as suas contas
                  do Instagram e excluindo todos os seus posts agendados.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setTargetUser(null)} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              variant={actionType === "delete" ? "destructive" : "default"}
              onClick={handleAction}
              disabled={submitting}
              className="gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
