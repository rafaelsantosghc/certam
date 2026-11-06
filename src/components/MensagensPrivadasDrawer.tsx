import React, { useEffect } from 'react';

interface MensagensPrivadasDrawerProps {
  aberto: boolean;
  onClose: () => void;
  destinatarioInicialEmail?: string;
  destinatarioInicialNome?: string;
}

/**
 * Redireciona qualquer abertura de Mensagens Privadas diretamente para a aba "Privadas"
 * integrada no PersistentChatWidget flutuante.
 */
export const MensagensPrivadasDrawer: React.FC<MensagensPrivadasDrawerProps> = ({
  aberto,
  onClose,
  destinatarioInicialEmail,
  destinatarioInicialNome,
}) => {
  useEffect(() => {
    if (aberto) {
      window.dispatchEvent(
        new CustomEvent('certam_abrir_dm_chat', {
          detail: {
            email: destinatarioInicialEmail || '',
            nome: destinatarioInicialNome || '',
          },
        })
      );
      onClose();
    }
  }, [aberto, destinatarioInicialEmail, destinatarioInicialNome, onClose]);

  return null;
};
