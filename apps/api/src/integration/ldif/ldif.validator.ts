import { Injectable } from '@nestjs/common';
import { LDIF, validateLdifStructure } from '@leanix-mock/shared';
import { LeanIxException } from '../../common/exceptions/leanix.exception';

@Injectable()
export class LdifValidatorService {
  assertValid(payload: unknown): LDIF {
    const result = validateLdifStructure(payload);
    if (!result.valid) {
      throw new LeanIxException('INVALID_LDIF', 'LDIF payload failed validation', {
        validationErrors: result.errors,
      });
    }
    return payload as LDIF;
  }
}
