import { Field, ObjectType } from '@nestjs/graphql';
import { Base } from 'lib/entities/base.entity';

@ObjectType()
export class Customer extends Base {
  @Field(() => String)
  email: string;
}
