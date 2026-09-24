import Button from '@/components/ui/Button';

// Login por senha compartilhada (admin, alta gestão, trainee). Fica num <form>
// pro Enter enviar e pro gerenciador de senhas oferecer salvar/preencher. O
// `usuario` oculto separa as três senhas no gerenciador — sem ele o navegador
// sugere a senha de admin no campo de trainee (mesmo site).
export default function FormSenha({ usuario, rotulo, value, onChange, onEntrar, loading }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onEntrar(); }}>
      <input type="text" name="username" autoComplete="username" value={usuario} readOnly hidden />
      <input
        type="password"
        name="password"
        autoComplete="current-password"
        aria-label={rotulo}
        placeholder={rotulo}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3.5 py-3 rounded-lg text-base outline-none focus:border-bordo mb-3"
      />
      <Button type="submit" loading={loading}>Entrar</Button>
    </form>
  );
}
