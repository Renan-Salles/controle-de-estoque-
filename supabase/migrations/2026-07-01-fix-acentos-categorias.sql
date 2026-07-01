-- migration 002 inseriu categorias sem acento (Agua, Guarana). Corrige pra
-- ficar certo em toda a UI (dropdowns, listagem de produtos etc).

update public.categorias set nome = 'Água' where nome = 'Agua';
update public.categorias set nome = 'Guaraná' where nome = 'Guarana';
