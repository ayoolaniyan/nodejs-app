import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Role } from 'src/authentication/role/enums/role.enum';
import { Base } from './base.entity';

registerEnumType(Role, { name: 'Role' });

@ObjectType()
export class Customer extends Base {
  @Field(() => String)
  email: string;

  @Field(() => Role)
  role: Role;
}
