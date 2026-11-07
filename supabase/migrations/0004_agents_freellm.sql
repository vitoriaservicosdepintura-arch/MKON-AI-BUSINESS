-- Agentes passam a usar o FreeLLMAPI (chave unificada) com encaminhamento automático.
-- Opcional: a aplicação já trata modelos antigos (ex.: gpt-4o-mini) como 'auto'.
alter table ai_agents alter column provider set default 'freellmapi';
alter table ai_agents alter column model    set default 'auto';

update ai_agents
   set provider = 'freellmapi', model = 'auto'
 where provider = 'openai' and model = 'gpt-4o-mini';
