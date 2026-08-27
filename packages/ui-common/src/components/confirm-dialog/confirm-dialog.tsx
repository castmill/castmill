/** @jsxImportSource solid-js */
import { Show, JSX } from 'solid-js';
import { Modal } from '../modal/modal';
import { Button } from '../button/button';

import './confirm-dialog.scss';

type ConfirmDialogProps = {
  show: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onClose: () => void;
  children?: JSX.Element;
};

export const ConfirmDialog = (props: ConfirmDialogProps): JSX.Element => {
  const handleConfirm = () => {
    props.onConfirm();
  };

  const handleClose = () => {
    props.onClose();
  };

  return (
    <Show when={props.show}>
      <Modal
        title={props.title}
        description={props.message}
        onClose={handleClose}
      >
        {props.children && (
          <div class="confirm-dialog-content">{props.children}</div>
        )}
        <div class="confirm-dialog-actions">
          <Button label="Confirm" color="danger" onClick={handleConfirm} />
          <Button label="Cancel" onClick={handleClose} />
        </div>
      </Modal>
    </Show>
  );
};
